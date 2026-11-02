import {
	BasesEntry,
	BasesView,
	Keymap,
	Menu,
	Notice,
	QueryController,
	TFile,
	TFolder,
	moment,
	setIcon,
} from "obsidian";
import { formatIsoDate, STATUS_CANCELLED, STATUS_DONE, STATUS_DELETED, STATUS_PENDING } from "./schema";
import { CanonicalField, Frontmatter, cachedFrontmatter } from "./fields";
import { tagFor } from "./tag-config";
import { ColorResolver, resolveColor } from "./color-utils";
import { ConfirmModal } from "./confirm-modal";
import { t } from "./i18n";
import { writeLog } from "./logger";
import { cardLabel, dbg, dragDebugAfterDrop, listLabel, nextRenderId } from "./drag-debug"; // DRAGDEBUG
import type WeekGridPlannerPlugin from "./main";
import { BODY_ICON_ID } from "./main";

export const WEEK_GRID_VIEW_TYPE = "wgp-week-grid";

/** "ago"/"seg" (like moment returns in pt-br) -> "Ago"/"Seg". */
function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Extracts the display "title" from a `Title — YYYY-MM-DD.md` file name. */
function extractTitle(baseName: string): string {
	const parts = baseName.split(" — ");
	return parts.length > 1 ? parts.slice(0, -1).join(" — ") : baseName;
}

/** Monday of the week that contains `d`. */
function mondayOfWeek(d: Date): Date {
	const result = new Date(d);
	const weekday = result.getDay(); // 0 = Sunday
	const offset = weekday === 0 ? -6 : 1 - weekday;
	result.setDate(result.getDate() + offset);
	result.setHours(0, 0, 0, 0);
	return result;
}

function addDays(d: Date, n: number): Date {
	const r = new Date(d);
	r.setDate(r.getDate() + n);
	return r;
}

/** Inverse of `formatIsoDate()` — local midnight, not UTC. */
function parseIsoDate(iso: string): Date {
	const [year, month, day] = iso.split("-").map(Number);
	return new Date(year, month - 1, day);
}

/** Frontmatter of a task/occurrence note, keyed by whatever YAML names are actually on disk (dynamic — see settings.fieldNames). */

export class WeekGridView extends BasesView {
	readonly type = WEEK_GRID_VIEW_TYPE;

	private rootEl: HTMLElement;
	private columnsEl: HTMLElement;
	private somedayEl: HTMLElement;
	private weekLabelEl!: HTMLElement;
	private todayButtonEl!: HTMLElement;

	/** Monday of the week currently shown. */
	private currentWeek: Date;
	/** ISO dates (Mon..Sun) of the week being shown — used in the "move" menu. */
	private currentWeekDaysIso: string[] = [];
	/** Paths of notes that have text beyond the frontmatter (recomputed on every render). */
	private notesWithBody = new Set<string>();
	/** Resolves/canonicalizes colors against the live theme — see color-utils.ts. */
	private colorResolver!: ColorResolver;
	/**
	 * Timestamp (Date.now()) until which any render() should skip its FLIP
	 * animation — used for week navigation (the whole board changes at
	 * once, shouldn't animate) and right after a drag-and-drop (the live
	 * placeholder already showed the movement, animating again would
	 * double up). A short window rather than a one-shot flag: a drop can
	 * trigger more than one render in quick succession — our own forced
	 * one plus Obsidian's own reactive one, from the same underlying write
	 * — and a one-shot flag only protects whichever of them happens to run
	 * first, leaving the other to animate against whatever *it* considers
	 * "before".
	 */
	private skipAnimationUntil = 0;
	/** File path of the card currently being dragged, if any — tracked in memory rather than read from dataTransfer, since dataTransfer.getData() isn't reliably readable during dragover in most browsers (only dragstart/drop). */
	private draggedPath: string | null = null;
	/** Pending post-drop safety re-render (see scheduleStuckRenderFallback). */
	private stuckRenderTimer: number | null = null;
	/** Counts drags started, so the fallback above can tell "the drag I was scheduled for" from "a newer one". */
	private dragSeq = 0;
	/** True once a drop handler has started actually moving the dragged card — dragend fires immediately after drop, before the async file update resolves. Guards the cancelled-drag cleanup in dragend: a successful drop deliberately leaves the placeholder and the hidden original card exactly as the live preview left them (see the drop handlers), so dragend must not touch either in that case — only a genuinely cancelled drag needs dragend to restore them itself. */
	private dropHandled = false;
	/** Reused across drags — a dashed "landing zone" box shown at wherever the dragged card would land if dropped right now. */
	private placeholderEl: HTMLElement | null = null;

	constructor(
		controller: QueryController,
		parentEl: HTMLElement,
		private plugin: WeekGridPlannerPlugin,
	) {
		super(controller);
		this.currentWeek = plugin.lastViewedWeekIso
			? parseIsoDate(plugin.lastViewedWeekIso)
			: mondayOfWeek(new Date());
		this.rootEl = parentEl.createDiv("wgp-root");
		this.colorResolver = new ColorResolver(this.rootEl);
		this.plugin.activeViews.add(this);
		this.buildHeader();
		this.columnsEl = this.rootEl.createDiv("wgp-columns");
		this.somedayEl = this.rootEl.createDiv("wgp-someday");
	}

	/** The YAML key currently configured for a canonical field (e.g. "date" -> "wgp_date"). */
	private key(field: CanonicalField): string {
		return this.plugin.settings.fieldNames[field];
	}

	private buildHeader() {
		const header = this.rootEl.createDiv("wgp-header");

		const navEl = header.createDiv("wgp-nav");
		const prevBtn = navEl.createEl("button", { cls: "wgp-nav-button clickable-icon", text: "‹" });
		prevBtn.onclick = () => this.navigateWeek(-1);

		this.weekLabelEl = navEl.createSpan("wgp-week-label");

		const nextBtn = navEl.createEl("button", { cls: "wgp-nav-button clickable-icon", text: "›" });
		nextBtn.onclick = () => this.navigateWeek(1);

		this.todayButtonEl = navEl.createEl("button", {
			text: t("button.today"),
			cls: "wgp-today-button wgp-nav-button clickable-icon",
		});
		this.todayButtonEl.onclick = () => this.setCurrentWeek(mondayOfWeek(new Date()));
	}

	private navigateWeek(deltaWeeks: number) {
		this.setCurrentWeek(addDays(this.currentWeek, deltaWeeks * 7));
	}

	/**
	 * Updates the shown week and remembers it on the plugin, so reopening
	 * this Base (e.g. via the note's back button, which recreates this view)
	 * lands back on the same week instead of resetting to today's.
	 */
	private setCurrentWeek(week: Date) {
		this.currentWeek = week;
		this.plugin.lastViewedWeekIso = formatIsoDate(week);
		this.skipAnimationUntil = Date.now() + 400;
		void this.render();
	}

	/** Called by Obsidian whenever the Base's data or configuration changes. */
	public onDataUpdated(): void {
		dbg("onDataUpdated"); // DRAGDEBUG
		void this.render();
	}

	/** Called when this view closes (tab closed, Base switched away from, etc.) — see plugin.activeViews. */
	public onunload(): void {
		this.plugin.activeViews.delete(this);
	}

	/** Forces a re-render — used by the plugin when a setting that affects rendering changes (see plugin.refreshAllViews()). */
	public refresh(): void {
		void this.render();
	}

	private allEntries(): BasesEntry[] {
		const entries: BasesEntry[] = [];
		for (const group of this.data.groupedData) {
			entries.push(...group.entries);
		}
		return entries;
	}

	private frontmatterOf(file: TFile): Frontmatter {
		return cachedFrontmatter(this.app, file) ?? {};
	}

	/** Reads the cache (usually no disk access) and checks whether text remains after the frontmatter. */
	private async hasBodyText(file: TFile): Promise<boolean> {
		try {
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatterEnd = cache?.frontmatterPosition?.end.offset ?? 0;
			const content = await this.app.vault.cachedRead(file);
			return content.slice(frontmatterEnd).trim().length > 0;
		} catch (error) {
			console.error(`Week Grid Planner: failed to read "${file.path}" to check for body text.`, error);
			return false;
		}
	}

	/** Sorts by `order` (lowest first); notes with no `order` go last, alphabetically among themselves. */
	private sortByOrder(entries: BasesEntry[]): BasesEntry[] {
		const orderKey = this.key("order");
		return [...entries].sort((a, b) => {
			const fmA = this.frontmatterOf(a.file);
			const fmB = this.frontmatterOf(b.file);
			const orderA = typeof fmA[orderKey] === "number" ? fmA[orderKey] : Number.MAX_SAFE_INTEGER;
			const orderB = typeof fmB[orderKey] === "number" ? fmB[orderKey] : Number.MAX_SAFE_INTEGER;
			if (orderA !== orderB) return orderA - orderB;
			return a.file.basename.localeCompare(b.file.basename);
		});
	}

	private shouldAnimateNextRender(): boolean {
		if (Date.now() < this.skipAnimationUntil) return false;
		return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}

	/** "First" step of FLIP: each currently-on-screen card's viewport position, keyed by file path — read BEFORE this render touches the DOM. Skips a card that's currently mid-drag (display: none, see createTaskCard's dragstart) — its getBoundingClientRect() would report an all-zero rect, not a meaningful position, which would otherwise animate it in from the top-left corner. */
	private captureCardRects(): Map<string, DOMRect> {
		const rects = new Map<string, DOMRect>();
		this.rootEl.querySelectorAll<HTMLElement>(".wgp-card[data-path]").forEach((el) => {
			if (el.style.display === "none") return;
			const path = el.getAttribute("data-path");
			if (path) rects.set(path, el.getBoundingClientRect());
		});
		dbg("captureCardRects", { captured: rects.size }); // DRAGDEBUG
		return rects;
	}

	/**
	 * "Last, Invert, Play" steps of FLIP: for every card that also existed
	 * before this render (matched by file path — the actual DOM node is a
	 * brand new element each render, that's fine, FLIP doesn't need node
	 * identity), computes how far it moved on screen, jumps it back there
	 * instantly with a transform, then releases the transform with a
	 * transition so the browser animates it smoothly into its real,
	 * already-laid-out position. A card with no previous position (newly
	 * created) is left alone — nothing to animate from.
	 */
	private animateCardMoves(firstRects: Map<string, DOMRect>) {
		dbg("animateCardMoves", { cardsWithPreviousRect: firstRects.size }); // DRAGDEBUG
		this.rootEl.querySelectorAll<HTMLElement>(".wgp-card[data-path]").forEach((el) => {
			const path = el.getAttribute("data-path");
			const first = path ? firstRects.get(path) : undefined;
			if (!first) return;

			const last = el.getBoundingClientRect();
			const dx = first.left - last.left;
			const dy = first.top - last.top;
			if (dx === 0 && dy === 0) return;
			dbg("FLIP invert", { card: cardLabel(el), dx: Math.round(dx), dy: Math.round(dy) }); // DRAGDEBUG

			el.style.transition = "none";
			el.style.transform = `translate(${dx}px, ${dy}px)`;
			el.getBoundingClientRect(); // forces layout, so the line above applies with no transition before the next frame

			window.requestAnimationFrame(() => {
				el.style.willChange = "transform";
				el.style.transition = "transform 150ms ease";
				el.style.transform = "";
				dbg("FLIP play", { card: cardLabel(el) }); // DRAGDEBUG
				el.addEventListener(
					"transitionend",
					() => {
						el.style.transition = "";
						el.style.willChange = "";
						dbg("FLIP end (transitionend)", { card: cardLabel(el) }); // DRAGDEBUG
					},
					{ once: true },
				);
			});
		});
	}

	private ensurePlaceholder(): HTMLElement {
		if (!this.placeholderEl) {
			this.placeholderEl = createDiv({ cls: "wgp-card-placeholder" });
		}
		return this.placeholderEl;
	}

	private removePlaceholder() {
		this.placeholderEl?.remove();
	}

	/**
	 * Last-resort insurance for a successful drop: normally Obsidian's own
	 * reactivity (onDataUpdated(), triggered once the frontmatter write
	 * lands) replaces the placeholder and hidden original card with the
	 * real, correct arrangement — deliberately not forced here (see the
	 * drop handlers' comments for why forcing an early render caused a
	 * flash to stale data in an earlier version). This is purely a
	 * fallback in case that reactivity somehow never fires: if the
	 * placeholder is still around 2 seconds after a drop, force a proper
	 * render ourselves rather than leaving the board looking stuck. A
	 * generous window on purpose — by the time this could matter, the
	 * normal path has almost certainly already finished, so it should
	 * essentially never actually do anything.
	 */
	private scheduleStuckRenderFallback() {
		if (this.stuckRenderTimer !== null) window.clearTimeout(this.stuckRenderTimer);
		const scheduledAtDrag = this.dragSeq;
		this.stuckRenderTimer = window.setTimeout(() => {
			this.stuckRenderTimer = null;
			// A *newer* drag started (it can begin within 2 s of the last drop) and is still
			// going: its placeholder is meant to be in the DOM, and re-rendering now would rebuild
			// the card being dragged — un-hiding it, shifting the list and skewing the drop index.
			// (Comparing drag numbers, not just draggedPath, keeps the rescue working if the drag
			// this timer belongs to never delivered its dragend.)
			if (this.draggedPath !== null && this.dragSeq !== scheduledAtDrag) {
				dbg("stuck-render fallback skipped: a new drag is in progress"); // DRAGDEBUG
				return;
			}
			dbg("stuck-render fallback fired", { placeholderConnected: !!this.placeholderEl?.isConnected }); // DRAGDEBUG
			if (this.placeholderEl?.isConnected) void this.render();
		}, 2000);
	}

	/**
	 * Live preview during a drag: moves the placeholder to sit right before
	 * the first card whose vertical midpoint is below the cursor — i.e.
	 * where the dragged card would land if dropped right now. The dragged
	 * card's own original element stays in the DOM but hidden
	 * (display: none — see dragstart in createTaskCard), so its
	 * getBoundingClientRect() collapses to zero and it's naturally skipped
	 * here without needing explicit filtering.
	 */
	private updatePlaceholderPosition(listEl: HTMLElement, clientY: number) {
		const placeholder = this.ensurePlaceholder();
		const cards = Array.from(listEl.querySelectorAll<HTMLElement>(":scope > .wgp-card")).filter(
			(card) => card.style.display !== "none",
		);

		let referenceEl: HTMLElement | null = null;
		for (const card of cards) {
			const rect = card.getBoundingClientRect();
			if (clientY < rect.top + rect.height / 2) {
				referenceEl = card;
				break;
			}
		}

		if (placeholder.parentElement !== listEl || placeholder.nextElementSibling !== referenceEl) {
			listEl.insertBefore(placeholder, referenceEl);
			dbg("placeholder moved", { list: listLabel(listEl), before: referenceEl ? cardLabel(referenceEl) : "(end of list)", y: Math.round(clientY), refMid: referenceEl ? Math.round(referenceEl.getBoundingClientRect().top + referenceEl.getBoundingClientRect().height / 2) : null }); // DRAGDEBUG
		}
	}

	/** How many *other* (non-dragged) cards in `listEl` sit before wherever the placeholder currently is — the index to pass to moveTaskToDate()/moveToSomedayAtPosition(). Falls back to "append at the end" if no live preview happened in this list (e.g. an unusually fast drag straight to drop). */
	private placeholderIndexAmongCards(listEl: HTMLElement): number {
		if (!this.placeholderEl || this.placeholderEl.parentElement !== listEl) {
			return listEl.querySelectorAll(":scope > .wgp-card").length;
		}
		const children = Array.from(listEl.children);
		const placeholderPos = children.indexOf(this.placeholderEl);
		let index = 0;
		for (let i = 0; i < placeholderPos; i++) {
			const child = children[i] as HTMLElement;
			if (child.classList.contains("wgp-card") && child.style.display !== "none") index++;
		}
		return index;
	}

	private async render() {
		const dbgId = nextRenderId(); // DRAGDEBUG
		const firstRects = this.shouldAnimateNextRender() ? this.captureCardRects() : null;
		dbg("render start", { id: dbgId, animate: firstRects !== null, skipWindowActive: Date.now() < this.skipAnimationUntil, dragInProgress: this.draggedPath !== null }); // DRAGDEBUG

		this.rootEl.toggleClass("wgp-text-wrap", this.plugin.settings.cardTextOverflow === "wrap");
		this.rootEl.style.setProperty("--wgp-side-border-width", `${this.plugin.settings.sideBorderThickness}px`);
		// Computed once here rather than per-card: some themes set
		// --background-secondary equal to --background-primary, which
		// would otherwise make every column visually flat against its own
		// cards (see color-utils.ts pickColumnBackground()).
		this.rootEl.style.setProperty(
			"--wgp-column-bg",
			this.colorResolver.pickColumnBackground("var(--background-primary)"),
		);

		const todayIso = formatIsoDate(new Date());
		const weekStartIso = formatIsoDate(this.currentWeek);
		const weekEnd = addDays(this.currentWeek, 6);

		const entries = this.allEntries();
		const files = entries.map((e) => e.file);
		const flags = await Promise.all(files.map((f) => this.hasBodyText(f)));
		this.notesWithBody = new Set(files.filter((_, i) => flags[i]).map((f) => f.path));

		this.weekLabelEl.setText(`${formatIsoDate(this.currentWeek)} — ${formatIsoDate(weekEnd)}`);
		this.todayButtonEl.toggleClass("is-hidden", weekStartIso === formatIsoDate(mondayOfWeek(new Date())));

		// Bucket 0..6 = Monday..Sunday; someday = no `date` property.
		const columns: BasesEntry[][] = [[], [], [], [], [], [], []];
		const someday: BasesEntry[] = [];

		const weekDaysIso = Array.from({ length: 7 }, (_, i) => formatIsoDate(addDays(this.currentWeek, i)));
		this.currentWeekDaysIso = weekDaysIso;

		const dateKey = this.key("date");
		const statusKey = this.key("status");

		for (const entry of entries) {
			const file = entry.file;
			const fm = this.frontmatterOf(file);
			// Soft-delete: the note still exists (keeps the master's slot occupied),
			// but doesn't show up in the view.
			if (fm[statusKey] === STATUS_DELETED) continue;

			const date = fm[dateKey];
			if (!date) {
				someday.push(entry);
				continue;
			}
			const index = weekDaysIso.indexOf(date as string);
			if (index !== -1) columns[index].push(entry);
		}

		this.renderColumns(columns.map((c) => this.sortByOrder(c)), weekDaysIso, todayIso);
		this.renderSomeday(this.sortByOrder(someday));

		if (firstRects) this.animateCardMoves(firstRects);
		dbg("render end", { id: dbgId }); // DRAGDEBUG
	}

	private renderColumns(columns: BasesEntry[][], daysIso: string[], todayIso: string) {
		this.columnsEl.empty();

		// Monday to Friday: one column each.
		for (let i = 0; i < 5; i++) {
			this.renderColumn(this.columnsEl, columns[i], daysIso[i], todayIso);
		}

		// 6th column: Saturday on top, Sunday below, each with its own list.
		const weekendColumnEl = this.columnsEl.createDiv("wgp-column wgp-column-weekend");
		this.renderColumn(weekendColumnEl, columns[5], daysIso[5], todayIso, true);
		this.renderColumn(weekendColumnEl, columns[6], daysIso[6], todayIso, true);
	}

	private renderColumn(
		parent: HTMLElement,
		entries: BasesEntry[],
		isoDate: string,
		todayIso: string,
		compact = false,
	) {
		const columnEl = parent.createDiv(`wgp-column${compact ? " wgp-column-compact" : ""}`);
		if (isoDate === todayIso) columnEl.addClass("wgp-column-today");

		const headerEl = columnEl.createDiv("wgp-column-header");
		headerEl.createSpan({
			text: capitalize(moment(isoDate).format("ddd")),
			cls: "wgp-column-day",
		});
		headerEl.createSpan({
			text: `${moment(isoDate).format("D")} ${capitalize(moment(isoDate).format("MMM"))}`,
			cls: "wgp-column-date",
		});

		const listEl = columnEl.createDiv("wgp-column-list");
		this.renderList(listEl, entries, isoDate, isoDate === todayIso);

		// Fixed strip always visible below the last card — without it, once
		// the column is already full (cards fill the column's whole
		// min-height), there's no empty clickable space left inside listEl
		// to open the inline new-task input.
		const addEl = columnEl.createDiv("wgp-column-add");
		addEl.setText("+");
		addEl.setAttr("aria-label", t("card.newTaskPlaceholder"));
		addEl.addEventListener("click", (ev) => {
			ev.stopPropagation();
			this.createInlineTask(listEl, isoDate);
		});

		// Click on empty space creates an inline task.
		columnEl.addEventListener("click", (ev) => {
			if (ev.target === listEl || ev.target === columnEl) {
				this.createInlineTask(listEl, isoDate);
			}
		});

		// Drop target for the whole column (header + list + add-strip) — the
		// live "landing zone" placeholder is positioned within listEl based
		// on cursor Y, but the hit area stays the full column so dropping
		// near the header or the "+" strip still works, matching the
		// original behavior.
		columnEl.addEventListener("dragover", (ev) => {
			if (!this.draggedPath) return;
			ev.preventDefault();
			this.updatePlaceholderPosition(listEl, ev.clientY);
		});
		columnEl.addEventListener("drop", (ev) => {
			ev.preventDefault();
			const path = this.draggedPath;
			const targetIndex = this.placeholderIndexAmongCards(listEl);
			dbg("drop", { list: listLabel(listEl), targetIndex, hasDraggedPath: !!path, placeholderInThisList: this.placeholderEl?.parentElement === listEl }); // DRAGDEBUG
			if (!path) {
				this.removePlaceholder();
				return;
			}
			this.dropHandled = true;
			dragDebugAfterDrop(this.rootEl, () => this.placeholderEl); // DRAGDEBUG
			this.skipAnimationUntil = Date.now() + 400;
			// Deliberately NOT removing the placeholder or un-hiding the
			// dragged card here. Two earlier attempts both caused visible
			// glitches: removing the placeholder eagerly let the list
			// reflow back toward its pre-drag layout for a moment (nothing
			// left to hold the gap open), which the next render then had
			// to re-animate away from — a second, redundant animation on
			// top of the live preview. Forcing our own render() right after
			// the write resolved raced against Obsidian's own reactivity
			// and sometimes ran against still-stale data, flashing the card
			// back at its old position before the real update corrected it.
			// Leaving both exactly as the live preview left them avoids
			// both: the board stays visually unchanged (matching what the
			// preview already showed) until Obsidian's own reactivity
			// replaces everything in one clean step, with nothing to
			// revert or flash in between.
			this.scheduleStuckRenderFallback();
			void this.moveTaskToDate(path, isoDate, targetIndex, entries);
		});
	}

	/** Renders the card list for a column/someday, with reordering context. */
	private renderList(listEl: HTMLElement, entries: BasesEntry[], isoDate: string | null, isToday = false) {
		entries.forEach((entry, index) => {
			listEl.appendChild(this.createTaskCard(entry, entries, index, isoDate, isToday));
		});
	}

	private createTaskCard(
		entry: BasesEntry,
		currentList: BasesEntry[],
		index: number,
		isoDate: string | null,
		isToday = false,
	): HTMLElement {
		const file = entry.file;
		const fm = this.frontmatterOf(file);
		const title = extractTitle(file.basename);
		const statusKey = this.key("status");
		const colorKey = this.key("color");

		const cardEl = createDiv({ cls: "wgp-card" });
		cardEl.setAttr("data-path", file.path);
		cardEl.addClass(`wgp-color-${this.plugin.settings.cardColorStyle}`);
		if (fm[statusKey] === STATUS_DONE) cardEl.addClass("wgp-card-done");
		if (fm[statusKey] === STATUS_CANCELLED) {
			const style = this.plugin.settings.cancelledTaskStyle;
			if (style === "strikethrough" || style === "both") cardEl.addClass("wgp-card-cancelled-strike");
			if (style === "red" || style === "both") cardEl.addClass("wgp-card-cancelled-red");
		}
		let resolvedColor = resolveColor(fm[colorKey] as string | undefined, this.plugin.settings.colorPalette);
		if (resolvedColor) {
			// A colored border (side-border) that matches the card's own
			// resting background is invisible, regardless of which day it's
			// on — so this check always runs. Today's own highlight is an
			// *additional* backdrop only today's column has.
			const avoidColors = ["var(--background-primary)"];
			if (isToday) avoidColors.push("var(--interactive-accent)");
			resolvedColor = this.colorResolver.avoidCollision(resolvedColor, avoidColors);
		}
		cardEl.toggleClass("wgp-has-color", Boolean(resolvedColor));
		if (resolvedColor) {
			cardEl.style.setProperty("--wgp-color", resolvedColor);
			cardEl.style.setProperty("--wgp-color-text", this.colorResolver.getContrastText(resolvedColor));
		}

		// Real drag-and-drop (desktop): move between days AND reorder within
		// a day, with a live placeholder showing where the card would land
		// (see updatePlaceholderPosition() — the actual dragover/drop
		// handling lives at the list level, not per-card, since computing
		// "where would this land" needs the whole list's layout, not just
		// one card's).
		cardEl.setAttr("draggable", "true");
		cardEl.addEventListener("dragstart", (ev) => {
			ev.dataTransfer?.setData("text/plain", file.path);
			this.draggedPath = file.path;
			this.dragSeq++;
			this.dropHandled = false;
			dbg("dragstart", { card: cardLabel(cardEl), list: isoDate ?? "someday", index }); // DRAGDEBUG
			// Deferred a frame: the browser captures its native drag-ghost
			// image synchronously from the element's current appearance
			// when dragstart fires — hiding it immediately here would make
			// that ghost blank. Waiting a frame lets the ghost render
			// first, then frees up the card's layout space for the
			// placeholder to occupy.
			window.requestAnimationFrame(() => {
				cardEl.style.display = "none";
				dbg("original card hidden (rAF)", { card: cardLabel(cardEl) }); // DRAGDEBUG
			});
			ev.stopPropagation();
		});
		cardEl.addEventListener("dragend", () => {
			dbg("dragend", { dropHandled: this.dropHandled }); // DRAGDEBUG
			this.draggedPath = null;
			if (!this.dropHandled) {
				// Genuinely cancelled (dropped outside any valid target,
				// Escape, etc.) — nothing else will clean this up, so
				// restore the card and remove the placeholder ourselves.
				cardEl.style.display = "";
				this.removePlaceholder();
			}
			// A successful drop deliberately does NOT touch either here —
			// see the drop handlers' comments for why.
		});

		const contentEl = cardEl.createSpan({ cls: "wgp-card-content" });

		if (this.notesWithBody.has(file.path)) {
			// Icon embedded via addIcon() (see main.ts) — no longer depends on
			// the Lucide icon set installed in Obsidian, so there's no need to
			// check its existence before use.
			const iconEl = contentEl.createSpan({ cls: "wgp-card-body-icon" });
			setIcon(iconEl, BODY_ICON_ID);
			iconEl.setAttr("aria-label", t("card.bodyIcon"));
		}

		contentEl.createSpan({ text: title, cls: "wgp-card-text" });
		contentEl.addEventListener("click", (ev) => {
			ev.stopPropagation();
			void this.app.workspace.openLinkText(file.path, "", Keymap.isModEvent(ev));
		});

		const moveBtn = cardEl.createEl("button", { cls: "wgp-card-move clickable-icon", text: "⋮" });
		moveBtn.onclick = (ev) => {
			ev.stopPropagation();
			this.openMoveMenu(ev, file, currentList, index);
		};

		const completeBtn = cardEl.createEl("button", { cls: "wgp-card-complete clickable-icon", text: "✓" });
		completeBtn.onclick = (ev) => {
			ev.stopPropagation();
			void this.app.fileManager.processFrontMatter(file, (currentFm: Frontmatter) => {
				if (currentFm[statusKey] === STATUS_DONE) {
					// Unmarking goes back to explicit "pending", not to the field
					// being absent — keeps the habit of status always being
					// present (see STATUS_PENDING in schema.ts) even on older
					// notes that already had some status set.
					currentFm[statusKey] = STATUS_PENDING;
				} else {
					currentFm[statusKey] = STATUS_DONE;
				}
			});
		};

		return cardEl;
	}

	/** Swaps the `order` of two adjacent items in the same list (used by the ▲/▼ buttons). */
	private async swapOrder(list: BasesEntry[], i: number, j: number) {
		const orderKey = this.key("order");
		const fileA = list[i].file;
		const fileB = list[j].file;
		const orderA = this.frontmatterOf(fileA)[orderKey] ?? i;
		const orderB = this.frontmatterOf(fileB)[orderKey] ?? j;
		await this.app.fileManager.processFrontMatter(fileA, (fm: Frontmatter) => (fm[orderKey] = orderB));
		await this.app.fileManager.processFrontMatter(fileB, (fm: Frontmatter) => (fm[orderKey] = orderA));
	}

	/**
	 * Reassigns sequential `order` (0, 1, 2…) to the whole list, with the
	 * `insertedPath` file placed at index `targetPosition`. Used after a
	 * drag-and-drop reorder within the same day/Someday.
	 */
	private async reorderList(originalList: BasesEntry[], insertedPath: string, targetPosition: number) {
		const orderKey = this.key("order");
		const withoutDragged = originalList.filter((e) => e.file.path !== insertedPath);
		const draggedFile = this.app.vault.getAbstractFileByPath(insertedPath);
		if (!(draggedFile instanceof TFile)) return;

		const paths = withoutDragged.map((e) => e.file.path);
		paths.splice(targetPosition, 0, insertedPath);

		for (let i = 0; i < paths.length; i++) {
			const file = this.app.vault.getAbstractFileByPath(paths[i]);
			if (file instanceof TFile) {
				dbg("write: order", { i, of: paths.length, card: file.basename }); // DRAGDEBUG
				await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
					fm[orderKey] = i;
				});
			}
		}
		dbg("reorder done"); // DRAGDEBUG
	}

	private createInlineTask(listEl: HTMLElement, isoDate: string | null) {
		const inputEl = listEl.createEl("input", {
			cls: "wgp-input-inline",
			attr: { type: "text", placeholder: t("card.newTaskPlaceholder") },
		});
		inputEl.focus();

		const confirm = async () => {
			const title = inputEl.value.trim();
			inputEl.remove();
			if (!title) return;
			await this.createTask(title, isoDate);
		};

		inputEl.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") void confirm();
			if (ev.key === "Escape") inputEl.remove();
		});
		inputEl.addEventListener("blur", () => void confirm());
	}

	private async createTask(title: string, isoDate: string | null) {
		const folder = this.plugin.settings.tasksFolder;
		if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) {
			new Notice(t("notice.taskFolderMissingOnCreate", { folder }));
			return;
		}
		const safeTitle = title.replace(/[\\/:*?"<>|#^[\]]/g, "").trim();
		const suffix = isoDate ? ` — ${isoDate}` : "";
		const path = `${folder}/${safeTitle}${suffix}.md`;
		if (this.app.vault.getAbstractFileByPath(path)) return;

		const { fieldNames, noteTag, useTagSuffixes } = this.plugin.settings;
		const tasksTag = tagFor({ tag: noteTag, useSuffixes: useTagSuffixes }, "tasks");
		const lines = ["---"];
		if (isoDate) lines.push(`${fieldNames.date}: ${isoDate}`);
		lines.push(`${fieldNames.status}: ${STATUS_PENDING}`);
		if (tasksTag) lines.push("tags:", `  - ${tasksTag}`);
		lines.push("---", "");
		await this.app.vault.create(path, lines.join("\n"));
	}

	private openMoveMenu(ev: MouseEvent, file: TFile, currentList: BasesEntry[], index: number) {
		const menu = new Menu();

		if (index > 0) {
			menu.addItem((item) =>
				item
					.setTitle(t("menu.moveUp"))
					.setIcon("arrow-up")
					.onClick(() => void this.swapOrder(currentList, index, index - 1)),
			);
		}
		if (index < currentList.length - 1) {
			menu.addItem((item) =>
				item
					.setTitle(t("menu.moveDown"))
					.setIcon("arrow-down")
					.onClick(() => void this.swapOrder(currentList, index, index + 1)),
			);
		}
		if (index > 0 || index < currentList.length - 1) menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle(t("menu.moveToDay"))
				.setIcon("calendar")
				.onClick((clickEvent) => {
					// The public Obsidian API has no submenu (setSubmenu is
					// internal/undocumented) — instead, we open a second,
					// independent menu at the click position.
					const mouseEvent = clickEvent instanceof MouseEvent ? clickEvent : ev;
					this.openChooseDayMenu(mouseEvent, file);
				}),
		);
		menu.addSeparator();

		const statusKey = this.key("status");
		const alreadyCancelled = this.frontmatterOf(file)[statusKey] === STATUS_CANCELLED;
		menu.addItem((item) =>
			item
				.setTitle(alreadyCancelled ? t("menu.unmarkCancelled") : t("menu.markCancelled"))
				.setIcon("ban")
				.onClick(() => {
					void this.app.fileManager.processFrontMatter(file, (currentFm: Frontmatter) => {
						currentFm[statusKey] = alreadyCancelled ? STATUS_PENDING : STATUS_CANCELLED;
					});
				}),
		);
		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle(t("menu.delete"))
				.setIcon("x")
				.setWarning(true)
				.onClick(() => {
					// Soft-delete: only marks the status, doesn't remove the note.
					// This also keeps the slot "occupied" for the recurrence
					// generator, with no exception needed.
					void this.app.fileManager.processFrontMatter(file, (currentFm: Frontmatter) => {
						currentFm[statusKey] = STATUS_DELETED;
					});
				}),
		);
		menu.addItem((item) =>
			item
				.setTitle(t("menu.deletePermanently"))
				.setIcon("trash")
				.setWarning(true)
				.onClick(() => void this.hardDelete(file)),
		);
		menu.showAtMouseEvent(ev);
	}

	/** Second menu, with the week's days + Someday — opened from "Move to day…". */
	private openChooseDayMenu(ev: MouseEvent, file: TFile) {
		const menu = new Menu();
		this.currentWeekDaysIso.forEach((isoDate) => {
			const label = `${capitalize(moment(isoDate).format("ddd"))} ${moment(isoDate).format("D")} ${capitalize(moment(isoDate).format("MMM"))}`;
			menu.addItem((item) =>
				item.setTitle(label).onClick(() => {
					void this.moveTaskToDate(file.path, isoDate, Number.MAX_SAFE_INTEGER);
				}),
			);
		});
		menu.addSeparator();
		menu.addItem((item) =>
			item.setTitle(t("menu.someday")).onClick(() => {
				const dateKey = this.key("date");
				void this.app.fileManager.processFrontMatter(file, (currentFm: Frontmatter) => {
					delete currentFm[dateKey];
				});
			}),
		);
		menu.showAtMouseEvent(ev);
	}

	/**
	 * Unlike "Delete" (soft-delete, marks status: deleted): this permanently
	 * removes the note. If it came from a master note, the slot frees up and
	 * the generator creates a new note on the next onLayoutReady() — that's
	 * how you force an occurrence to be recreated (e.g. after changing the
	 * color on the master).
	 */
	private hardDelete(file: TFile) {
		const removeFile = () => void this.doHardDelete(file);

		if (!this.plugin.settings.confirmHardDelete) {
			removeFile();
			return;
		}

		new ConfirmModal(
			this.app,
			t("confirm.deleteTitle"),
			t("confirm.deleteMessage", { title: extractTitle(file.basename) }),
			removeFile,
		).open();
	}

	private async doHardDelete(file: TFile) {
		const path = file.path;
		try {
			await this.app.fileManager.trashFile(file);
			await writeLog(
				this.app,
				this.plugin.settings.activityLogEnabled,
				this.plugin.settings.activityLogPath,
				"Deleted note permanently (manual)",
				{ details: [path] },
			);
		} catch (error) {
			console.error(`Week Grid Planner: failed to permanently delete "${path}".`, error);
			await writeLog(
				this.app,
				this.plugin.settings.activityLogEnabled,
				this.plugin.settings.activityLogPath,
				"Failed to delete note permanently (manual)",
				{ severity: "error", details: [path] },
			);
		}
	}

	private async moveTaskToDate(
		path: string,
		newIsoDate: string,
		position: number,
		destinationList?: BasesEntry[],
	) {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;

		const dateKey = this.key("date");
		const orderKey = this.key("order");

		dbg("write: date begin", { card: file.basename, newIsoDate, position }); // DRAGDEBUG
		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			fm[dateKey] = newIsoDate;
		});
		dbg("write: date done"); // DRAGDEBUG

		if (destinationList) {
			await this.reorderList(destinationList, path, position);
		} else {
			await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
				fm[orderKey] = position;
			});
		}

		const title = extractTitle(file.basename);
		const folder = file.parent?.path ?? this.plugin.settings.tasksFolder;
		const newPath = `${folder}/${title} — ${newIsoDate}.md`;
		if (newPath !== file.path && !this.app.vault.getAbstractFileByPath(newPath)) {
			dbg("rename begin", { to: newPath }); // DRAGDEBUG
			await this.app.fileManager.renameFile(file, newPath);
			dbg("rename done"); // DRAGDEBUG
		}
	}

	private async moveToSomedayAtPosition(path: string, list: BasesEntry[], position: number) {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		const dateKey = this.key("date");
		dbg("write: date removal begin", { card: file.basename, position }); // DRAGDEBUG
		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			delete fm[dateKey];
		});
		dbg("write: date removal done"); // DRAGDEBUG
		await this.reorderList(list, path, position);
	}

	private renderSomeday(entries: BasesEntry[]) {
		this.somedayEl.empty();
		this.somedayEl.createDiv({ text: t("menu.someday"), cls: "wgp-someday-title" });
		const listEl = this.somedayEl.createDiv("wgp-someday-list");
		this.renderList(listEl, entries, null);

		// Same "+" strip + click-to-add-inline-task affordance every day
		// column has — this was simply never built for Someday before.
		const addEl = this.somedayEl.createDiv("wgp-column-add");
		addEl.setText("+");
		addEl.setAttr("aria-label", t("card.newTaskPlaceholder"));
		addEl.addEventListener("click", (ev) => {
			ev.stopPropagation();
			this.createInlineTask(listEl, null);
		});

		this.somedayEl.addEventListener("click", (ev) => {
			if (ev.target === listEl || ev.target === this.somedayEl) {
				this.createInlineTask(listEl, null);
			}
		});

		listEl.addEventListener("dragover", (ev) => {
			if (!this.draggedPath) return;
			ev.preventDefault();
			this.updatePlaceholderPosition(listEl, ev.clientY);
		});
		listEl.addEventListener("drop", (ev) => {
			ev.preventDefault();
			const path = this.draggedPath;
			const targetIndex = this.placeholderIndexAmongCards(listEl);
			dbg("drop", { list: listLabel(listEl), targetIndex, hasDraggedPath: !!path, placeholderInThisList: this.placeholderEl?.parentElement === listEl }); // DRAGDEBUG
			if (!path) {
				this.removePlaceholder();
				return;
			}
			this.dropHandled = true;
			dragDebugAfterDrop(this.rootEl, () => this.placeholderEl); // DRAGDEBUG
			this.skipAnimationUntil = Date.now() + 400;
			// See the identical comment in renderColumn()'s drop handler —
			// deliberately leaves the placeholder and hidden original card
			// untouched until Obsidian's own reactivity replaces everything
			// in one clean step.
			this.scheduleStuckRenderFallback();
			void this.moveToSomedayAtPosition(path, entries, targetIndex);
		});
	}
}
