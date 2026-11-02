/**
 * TEMPORARY — development-only drag-and-drop trace. Not a feature.
 *
 * To remove it completely: delete this file, delete every line tagged
 * `DRAGDEBUG` in view.ts and main.ts (`grep -rn DRAGDEBUG src`), and drop the
 * 0.3.27 CHANGELOG entry. Nothing else depends on it.
 *
 * It only observes — it never changes how dragging behaves. Events are kept
 * in memory (ring buffer) and only recorded while a drag is in progress, plus
 * a few seconds after it ends (to catch the board settling after the drop).
 * The buffer is written to `drag-debug.log` in the plugin's own folder a few
 * seconds after the last event (one write per drag, never per event), and the
 * "Copy drag debug log (temporary)" command puts it on the clipboard.
 */
import { apiVersion, App, Notice, Platform } from "obsidian";

const MAX_EVENTS = 500;
const FLUSH_DELAY_MS = 3000;
/** How long after dragend events are still recorded (covers the +2.5 s state snapshot). */
const POST_DRAG_WINDOW_MS = 7000;

let appRef: App | null = null;
let logPath = "";
let header = "";
const events: string[] = [];
let t0 = performance.now();
let dragging = false;
let activeUntil = 0;
let renderSeq = 0;
let flushTimer: number | undefined;

export function dragDebugInit(app: App, pluginDir: string | undefined, pluginVersion: string): void {
	appRef = app;
	logPath = pluginDir ? `${pluginDir}/drag-debug.log` : "";
	header = `Week Grid Planner drag debug log — plugin ${pluginVersion}, Obsidian API ${apiVersion}, ${
		Platform.isMobile ? "mobile" : "desktop"
	}`;
}

/** Id to tell overlapping async renders apart in the log. */
export function nextRenderId(): number {
	return ++renderSeq;
}

/** Human-readable label for a card element: its visible title, else its path. */
export function cardLabel(el: Element | null): string {
	if (!el) return "(none)";
	const text = el.querySelector(".wgp-card-text")?.textContent;
	return (text ?? el.getAttribute("data-path") ?? "?").slice(0, 28);
}

/** Human-readable label for a column list ("Mon 2 Nov") or the Someday list. */
export function listLabel(listEl: HTMLElement): string {
	if (listEl.classList.contains("wgp-someday-list")) return "someday";
	const column = listEl.parentElement;
	const day = column?.querySelector(".wgp-column-day")?.textContent ?? "?";
	const date = column?.querySelector(".wgp-column-date")?.textContent ?? "";
	return `${day} ${date}`.trim();
}

export function dbg(event: string, data?: Record<string, unknown>): void {
	const now = performance.now();
	if (event === "dragstart") {
		dragging = true;
		t0 = now;
		events.push(`--- ${new Date().toISOString()} ---`);
	} else if (!dragging && now > activeUntil) {
		return;
	}

	const ms = String(Math.round(now - t0)).padStart(5);
	events.push(`+${ms}ms ${event}${data ? " " + JSON.stringify(data) : ""}`);
	if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);

	if (event === "dragend") {
		dragging = false;
		activeUntil = now + POST_DRAG_WINDOW_MS;
	}
	scheduleFlush();
}

/** What the board looks like right now — the "silly glitch" detector: stuck placeholder, hidden card, leftover animation styles, duplicated cards. */
export function dragDebugSnapshot(label: string, rootEl: HTMLElement, placeholderEl: HTMLElement | null): void {
	const cards = Array.from(rootEl.querySelectorAll<HTMLElement>(".wgp-card[data-path]"));
	const paths = cards.map((c) => c.getAttribute("data-path"));
	const duplicates = paths.filter((p, i) => paths.indexOf(p) !== i).length;
	dbg(label, {
		cards: cards.length,
		duplicatePaths: duplicates,
		placeholderConnected: !!placeholderEl?.isConnected,
		placeholdersInDom: rootEl.querySelectorAll(".wgp-card-placeholder").length,
		hiddenCards: cards.filter((c) => c.style.display === "none").map(cardLabel),
		leftoverInlineAnim: cards.filter((c) => c.style.transition || c.style.transform).map(cardLabel),
	});
}

/** Board-state snapshots shortly after a drop, once the normal reactivity should have finished. */
export function dragDebugAfterDrop(rootEl: HTMLElement, getPlaceholder: () => HTMLElement | null): void {
	for (const delay of [300, 2500]) {
		window.setTimeout(() => dragDebugSnapshot(`state ${delay}ms after drop`, rootEl, getPlaceholder()), delay);
	}
}

function logText(): string {
	return [header, ...events].join("\n") + "\n";
}

async function flush(): Promise<void> {
	if (!appRef || !logPath) return;
	try {
		await appRef.vault.adapter.write(logPath, logText());
	} catch {
		// Dev-only tool: a failed write must never disturb the plugin.
	}
}

function scheduleFlush(): void {
	window.clearTimeout(flushTimer);
	flushTimer = window.setTimeout(() => void flush(), FLUSH_DELAY_MS);
}

export async function dragDebugCopy(): Promise<void> {
	await flush();
	try {
		await navigator.clipboard.writeText(logText());
		new Notice(`Drag debug log copied (${events.length} lines).`);
	} catch {
		new Notice("Couldn't copy the drag debug log — it was saved as drag-debug.log in the plugin folder.");
	}
}
