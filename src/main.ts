import { addIcon, Notice, Plugin } from "obsidian";
import { bringOverdueToToday, bringOverdueToSomeday } from "./bulk-actions";
import { deleteFiles, listOldTasks } from "./cleanup";
import { DeleteOldTasksModal } from "./cleanup-modal";
import { findDuplicateMasterIds } from "./conflicts";
import { MasterConflictsModal } from "./conflicts-modal";
import { generateOccurrences } from "./recurrence";
import { DEFAULT_SETTINGS, WeekGridPlannerSettings, WeekGridPlannerSettingTab } from "./settings";
import { backfillTag, countUntagged } from "./tag-backfill";
import { tagFor, TagConfig } from "./tag-config";
import { ConfirmModal } from "./confirm-modal";
import { TemplateGeneratorModal } from "./template-generator-modal";
import { WEEK_GRID_VIEW_TYPE, WeekGridView } from "./view";
import { t } from "./i18n";
import { writeLog } from "./logger";
import { dragDebugCopy, dragDebugInit } from "./drag-debug"; // DRAGDEBUG

/**
 * ID of the custom icon registered via addIcon(). We embed the Lucide
 * "square-text" icon's SVG directly in the plugin instead of relying on
 * setIcon("square-text") — that icon is recent (Lucide 1.32+) and may not
 * exist in the icon set bundled with older Obsidian builds (mobile,
 * mainly), where setIcon() silently fails.
 */
export const BODY_ICON_ID = "wgp-square-text";

/**
 * Content of Lucide's "square-text" icon (original viewBox 0 0 24), scaled
 * to the 0 0 100 viewBox that addIcon() expects (factor 100/24 ≈ 4.16667).
 * The presentation attributes (fill/stroke) that normally live on the
 * original <svg> tag need to move to the <g>, since addIcon() strips the
 * <svg> tag itself.
 */
const BODY_ICON_SVG = `<g transform="scale(4.16667)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
	<rect width="18" height="18" x="3" y="3" rx="2"/>
	<path d="M7 8h8"/><path d="M7 12h10"/><path d="M7 16h6"/>
</g>`;

export default class WeekGridPlannerPlugin extends Plugin {
	settings!: WeekGridPlannerSettings;

	/**
	 * ISO date (Monday) of the last week shown in any Week Grid view, kept
	 * in memory only (not persisted to data.json). Bases recreates the view
	 * instance — losing its own fields — whenever the user navigates back to
	 * the Base tab (e.g. after opening a task note in the same leaf), so
	 * WeekGridView reads/writes this on the plugin to survive that and
	 * reopen on the same week instead of snapping back to today's.
	 */
	lastViewedWeekIso: string | null = null;

	/**
	 * Every currently open Week Grid view (there can be more than one Base
	 * using this view type open at once). Settings changes don't otherwise
	 * reach an already-open view — Obsidian only calls onDataUpdated() when
	 * the underlying data changes, not when a plugin setting does — so
	 * anything that affects how a card renders needs to explicitly call
	 * refreshAllViews() after saving.
	 */
	activeViews = new Set<WeekGridView>();

	refreshAllViews(): void {
		for (const view of this.activeViews) view.refresh();
	}

	async onload() {
		addIcon(BODY_ICON_ID, BODY_ICON_SVG);
		await this.loadSettings();
		dragDebugInit(this, this.manifest.dir, this.manifest.version); // DRAGDEBUG
		this.addSettingTab(new WeekGridPlannerSettingTab(this.app, this));

		const registered = this.registerBasesView(WEEK_GRID_VIEW_TYPE, {
			name: "Week Grid Planner",
			icon: "lucide-calendar-days",
			factory: (controller, containerEl) => new WeekGridView(controller, containerEl, this),
		});
		if (!registered) {
			console.warn("Week Grid Planner: the Bases feature isn't enabled in this vault.");
		}

		this.addCommand({ // DRAGDEBUG
			id: "copy-drag-debug-log", // DRAGDEBUG
			name: "Copy drag debug log (temporary)", // DRAGDEBUG
			callback: () => void dragDebugCopy(), // DRAGDEBUG
		}); // DRAGDEBUG

		this.addCommand({
			id: "generate-occurrences-now",
			name: t("command.generateNow"),
			callback: () => void this.generateOccurrencesWithNotice(true),
		});

		this.addCommand({
			id: "delete-old-tasks",
			name: t("command.deleteOldTasks"),
			callback: () => new DeleteOldTasksModal(this.app, this).open(),
		});

		this.addCommand({
			id: "bring-overdue-to-today",
			name: t("command.bringOverdueToToday"),
			callback: () => void this.bringOverdueWithNotice("today"),
		});

		this.addCommand({
			id: "bring-overdue-to-someday",
			name: t("command.bringOverdueToSomeday"),
			callback: () => void this.bringOverdueWithNotice("someday"),
		});

		this.addCommand({
			id: "check-master-conflicts",
			name: t("command.checkMasterConflicts"),
			callback: () => void this.checkMasterConflicts(true),
		});

		this.addCommand({
			id: "add-tags-to-existing-notes",
			name: t("command.addTagsToExisting"),
			callback: () => void this.addTagsToExistingNotes(),
		});

		this.addCommand({
			id: "generate-note-templates",
			name: t("command.generateTemplates"),
			callback: () => new TemplateGeneratorModal(this.app, this).open(),
		});

		// Sequenced on purpose: generation should complete before the
		// conflict check runs, so a master note created moments ago is
		// already accounted for.
		this.app.workspace.onLayoutReady(() => {
			void (async () => {
				await this.generateOccurrencesWithNotice(false);
				await this.autoDeleteOldTasks();
				await this.checkMasterConflicts(false);
			})();
		});
	}

	/**
	 * @param alwaysNotify If true (manual command), shows a Notice even with
	 * 0 occurrences generated — gives feedback that the command ran. If
	 * false (automatic, in onLayoutReady), only notifies when something was
	 * actually created, so it doesn't nag every time Obsidian opens with
	 * nothing new.
	 */
	private async generateOccurrencesWithNotice(alwaysNotify: boolean) {
		const { createdCount, missingFolders } = await generateOccurrences(this.app, this.settings);

		if (missingFolders.length > 0) {
			const folders = missingFolders.join(", ");
			new Notice(
				this.settings.foldersConfigured
					? t("notice.foldersMissing", { folders })
					: t("notice.firstRunSetup", { folders }),
			);
			return;
		}
		if (!this.settings.foldersConfigured) {
			this.settings.foldersConfigured = true;
			await this.saveSettings();
		}

		if (createdCount > 0) {
			new Notice(t("notice.occurrencesGenerated", { n: createdCount }));
		} else if (alwaysNotify) {
			new Notice(
				this.settings.horizonDays === 0 ? t("notice.generationDisabled") : t("notice.noNewOccurrences"),
			);
		}
	}

	/** "today" → moves overdue tasks to today; "someday" → removes `date` (sends to Someday). */
	private async bringOverdueWithNotice(destination: "today" | "someday") {
		const n =
			destination === "today"
				? await bringOverdueToToday(this.app, this.settings.tasksFolder, this.settings.fieldNames)
				: await bringOverdueToSomeday(this.app, this.settings.tasksFolder, this.settings.fieldNames);

		if (n > 0) {
			const key = destination === "today" ? "notice.overdueToToday" : "notice.overdueToSomeday";
			new Notice(t(key, { n }));
		} else {
			new Notice(t("notice.noOverdueFound"));
		}
	}

	/**
	 * Automatic version of "Delete old tasks…", with no modal or
	 * confirmation — only runs if `autoCleanup` isn't set to "never"
	 * (default), and only notifies when something was actually deleted
	 * (same spirit as generateOccurrencesWithNotice(false), so it doesn't
	 * nag all the time).
	 */
	private async autoDeleteOldTasks() {
		if (this.settings.autoCleanup === "never") return;
		const files = await listOldTasks(this.app, this.settings.tasksFolder, this.settings.autoCleanup, this.settings.fieldNames);
		if (files.length === 0) return;
		const { deletedPaths, failedPaths } = await deleteFiles(this.app, files);
		if (deletedPaths.length > 0) {
			new Notice(t("notice.autoCleanup", { n: deletedPaths.length }));
			await writeLog(
				this.app,
				this.settings.activityLogEnabled,
				this.settings.activityLogPath,
				`Auto-deleted ${deletedPaths.length} old task(s)`,
				{ details: deletedPaths },
			);
		}
		if (failedPaths.length > 0) {
			await writeLog(
				this.app,
				this.settings.activityLogEnabled,
				this.settings.activityLogPath,
				`Failed to auto-delete ${failedPaths.length} old task(s)`,
				{ severity: "error", details: failedPaths },
			);
		}
	}

	/**
	 * @param openModalIfFound If true (manual command), always shows either
	 * the "none found" Notice or the full report modal. If false (automatic,
	 * in onLayoutReady), only shows a quiet Notice pointing at the command —
	 * no modal popping up unprompted on every vault open.
	 */
	private async checkMasterConflicts(openModalIfFound: boolean) {
		const conflicts = await findDuplicateMasterIds(this.app, this.settings.mastersFolder, this.settings.fieldNames);
		if (conflicts.length === 0) {
			if (openModalIfFound) new Notice(t("notice.noMasterConflicts"));
			return;
		}
		if (openModalIfFound) {
			new MasterConflictsModal(this.app, conflicts).open();
		} else {
			new Notice(t("notice.masterConflictsWarning", { n: conflicts.length }));
		}
	}

	/**
	 * "Add tags to existing notes…": counts how many notes in the masters
	 * and tasks folders are missing the configured tag first, so the
	 * confirm message shows a real number — no vault content is touched
	 * until the person explicitly confirms.
	 */
	private async addTagsToExistingNotes() {
		const config: TagConfig = { tag: this.settings.noteTag, useSuffixes: this.settings.useTagSuffixes };
		const mastersTag = tagFor(config, "masters");
		const tasksTag = tagFor(config, "tasks");
		if (!mastersTag && !tasksTag) {
			new Notice(t("notice.tagNotConfigured"));
			return;
		}

		const mastersMissing = mastersTag ? await countUntagged(this.app, this.settings.mastersFolder, mastersTag) : 0;
		const tasksMissing = tasksTag ? await countUntagged(this.app, this.settings.tasksFolder, tasksTag) : 0;
		const total = mastersMissing + tasksMissing;

		if (total === 0) {
			new Notice(t("tagBackfill.noneFound"));
			return;
		}

		new ConfirmModal(
			this.app,
			t("tagBackfill.confirmTitle"),
			t("tagBackfill.confirmMessage", { n: total }),
			() => void this.runTagBackfill(mastersTag, tasksTag),
			t("tagBackfill.confirmButton"),
			false,
		).open();
	}

	private async runTagBackfill(mastersTag: string | null, tasksTag: string | null) {
		const mastersModified = mastersTag ? await backfillTag(this.app, this.settings.mastersFolder, mastersTag) : 0;
		const tasksModified = tasksTag ? await backfillTag(this.app, this.settings.tasksFolder, tasksTag) : 0;
		new Notice(t("tagBackfill.done", { n: mastersModified + tasksModified }));
	}

	async loadSettings() {
		const data = ((await this.loadData()) ?? {}) as Partial<WeekGridPlannerSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		// Upgrading from a version that had `noteTag` but no `pendingNoteTag`
		// yet: seed the pending fields from the active tag, not the default
		// fallback, so Settings shows what was already configured instead of
		// silently reverting the box to "wgp".
		if (!("pendingNoteTag" in data)) {
			this.settings.pendingNoteTag = this.settings.noteTag;
		}
		if (!("pendingUseTagSuffixes" in data)) {
			this.settings.pendingUseTagSuffixes = this.settings.useTagSuffixes;
		}
		// "full-border" was removed as a cardColorStyle option — anyone who
		// had it selected falls back to "side-border" rather than being left
		// on a value the dropdown no longer offers.
		if ((this.settings.cardColorStyle as string) === "full-border") {
			this.settings.cardColorStyle = "side-border";
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
