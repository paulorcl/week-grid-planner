import { RRule } from "rrule";
import { App, Notice, TFile, TFolder } from "obsidian";
import { STATUS_PENDING, MasterNote, TaskOccurrence, formatIsoDate } from "./schema";
import { FieldNameMap, Frontmatter, cachedFrontmatter } from "./fields";
import { tagFor } from "./tag-config";
import type { WeekGridPlannerSettings } from "./settings";
import { t } from "./i18n";
import { writeLog } from "./logger";

/**
 * rrule.js works internally in UTC. If we mix it with local Date, we hit the
 * same timezone bug (UTC vs. Brazil time) that already showed up in the
 * Tauri prototype — occurrences "disappearing" near the day boundary. To
 * avoid this, we treat every calendar date as a "floating day": RRULE dates
 * are always built and read via UTC methods (Date.UTC / getUTC*), never via
 * local constructors/methods.
 */
function isoToUtcDate(iso: string): Date {
	const [year, month, day] = iso.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

function utcDateToIso(d: Date): string {
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** Lists every .md file inside a folder, including subfolders. */
export function listNotesRecursively(folder: TFolder): TFile[] {
	const files: TFile[] = [];
	for (const child of folder.children) {
		if (child instanceof TFile && child.extension === "md") {
			files.push(child);
		} else if (child instanceof TFolder) {
			files.push(...listNotesRecursively(child));
		}
	}
	return files;
}

/**
 * Detects "risky" rules: with no explicit BYDAY/BYMONTHDAY/BYMONTH and no
 * `date` field on the master note, the recurrence anchor ends up depending
 * on whatever day the plugin first ran — unpredictable. FREQ=DAILY is never
 * ambiguous (every day is every day, the anchor doesn't matter).
 */
function ruleLooksRisky(options: Partial<import("rrule").Options>): boolean {
	if (options.freq === RRule.DAILY) return false;
	const isEmpty = (v: unknown) => !v || (Array.isArray(v) && v.length === 0);
	return isEmpty(options.bymonthday) && isEmpty(options.bymonth) && isEmpty(options.byweekday);
}

/**
 * Best-effort wait for Obsidian's metadata cache to have parsed every note
 * in the given folders before generation reads it. onLayoutReady() only
 * guarantees the workspace *layout* is restored — not that every file's
 * frontmatter has been indexed yet. This is most visible with external
 * sync (e.g. Dropbox syncing files in outside of Obsidian): a batch of
 * files can land on disk while Obsidian is still catching up, and if
 * generation runs before an *existing* occurrence's frontmatter is cached,
 * readExistingSlots() sees that slot as empty and creates a duplicate for
 * it. Polls rather than hooking metadataCache's "resolved" event, since
 * that event covers the *whole vault* (more than needed here) and fires
 * again on every later edit anywhere — awkward to consume exactly once for
 * just these two folders. Gives up after maxWaitMs and proceeds anyway
 * rather than hanging indefinitely; no worse than the pre-fix behavior in
 * the worst case.
 *
 * Known gap: this only catches a file with *no* cache entry yet (a file
 * Obsidian has never indexed on this device) — it can't detect a *stale*
 * cache entry for a file that already had one before an external edit
 * changed it, since getFileCache() still returns something non-null in
 * that case. In practice the common external-sync case is new/renamed
 * occurrence notes landing on disk that this device hasn't seen before,
 * which this does cover.
 */
async function waitForFolderMetadataReady(
	app: App,
	folders: string[],
	maxWaitMs = 10000,
	pollIntervalMs = 200,
): Promise<void> {
	const deadline = Date.now() + maxWaitMs;
	while (Date.now() < deadline) {
		const files = folders.flatMap((folderPath) => {
			const folder = app.vault.getAbstractFileByPath(folderPath);
			return folder instanceof TFolder ? listNotesRecursively(folder) : [];
		});
		const allCached = files.every((file) => app.metadataCache.getFileCache(file) !== null);
		if (allCached) return;
		await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
	}
}

const MANAGED_MASTER_KEYS_EXTRA = new Set(["tags", "position"]);

/**
 * Reads every master note in the configured masters folder (and
 * subfolders), using the configured YAML key names. Also captures anything
 * NOT managed by the plugin — extra frontmatter properties, tags other
 * than the master's own plugin tag, and body text — so it can be carried
 * over onto new occurrences (see buildOccurrenceContent()).
 */
async function readMasters(
	app: App,
	mastersFolder: string,
	fieldNames: FieldNameMap,
	mastersTag: string | null,
): Promise<MasterNote[]> {
	const folder = app.vault.getAbstractFileByPath(mastersFolder);
	if (!(folder instanceof TFolder)) return [];

	const managedKeys = new Set([
		fieldNames.master_id,
		fieldNames.rrule,
		fieldNames.title,
		fieldNames.color,
		fieldNames.date,
		...MANAGED_MASTER_KEYS_EXTRA,
	]);

	const masters: MasterNote[] = [];
	for (const file of listNotesRecursively(folder)) {
		const cache = app.metadataCache.getFileCache(file);
		const fm = (cache?.frontmatter ?? {}) as Record<string, unknown>;
		const masterId = fm[fieldNames.master_id];
		const rrule = fm[fieldNames.rrule];
		if (!masterId || !rrule) continue;

		const extraFrontmatter: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(fm)) {
			if (!managedKeys.has(key)) extraFrontmatter[key] = value;
		}

		const rawTags = fm.tags;
		const tagList = Array.isArray(rawTags) ? rawTags.map(String) : typeof rawTags === "string" ? [rawTags] : [];
		const extraTags = tagList.filter((tagValue) => tagValue !== mastersTag);

		let body = "";
		try {
			const frontmatterEnd = cache?.frontmatterPosition?.end.offset ?? 0;
			const content = await app.vault.cachedRead(file);
			body = content.slice(frontmatterEnd).trim();
		} catch (error) {
			console.error(`Week Grid Planner: failed to read body of master "${file.path}".`, error);
		}

		masters.push({
			master_id: masterId as string,
			rrule: rrule as string,
			title: (fm[fieldNames.title] as string) ?? file.basename,
			color: fm[fieldNames.color] as string | undefined,
			date: fm[fieldNames.date] as string | undefined,
			extraFrontmatter,
			extraTags,
			body,
		});
	}
	return masters;
}

/** Reads the set of (master_id, original_date) pairs already present in the tasks folder (and subfolders). */
async function readExistingSlots(app: App, tasksFolder: string, fieldNames: FieldNameMap): Promise<Set<string>> {
	const folder = app.vault.getAbstractFileByPath(tasksFolder);
	const slots = new Set<string>();
	if (!(folder instanceof TFolder)) return slots;

	for (const file of listNotesRecursively(folder)) {
		const fm = cachedFrontmatter(app, file);
		const masterId = fm?.[fieldNames.master_id] as TaskOccurrence["master_id"];
		const originalDate = fm?.[fieldNames.original_date] as TaskOccurrence["original_date"];
		if (!masterId || !originalDate) continue;
		slots.add(`${masterId}::${originalDate}`);
	}
	return slots;
}

/**
 * Builds the plugin-managed frontmatter (+ the master's body text, if any)
 * of a new occurrence note. Extra frontmatter properties and non-plugin
 * tags from the master are applied separately, after creation — see
 * applyOccurrenceExtras() — since those can hold arbitrary values (arrays,
 * numbers, nested structures) that need a real YAML writer, not string
 * concatenation.
 */
function buildOccurrenceContent(master: MasterNote, isoDate: string, fieldNames: FieldNameMap): string {
	const lines = [
		"---",
		`${fieldNames.master_id}: ${master.master_id}`,
		`${fieldNames.date}: ${isoDate}`,
		`${fieldNames.original_date}: ${isoDate}`,
		`${fieldNames.status}: ${STATUS_PENDING}`,
	];
	// Hex values start with "#", which opens a comment in YAML if unquoted —
	// without the quotes here, the color silently turns into null on reread.
	if (master.color) lines.push(`${fieldNames.color}: "${master.color}"`);
	lines.push("---", "");
	const frontmatter = lines.join("\n");
	return master.body ? `${frontmatter}\n${master.body}` : frontmatter;
}

/**
 * Applies whatever buildOccurrenceContent() couldn't safely write as plain
 * text: the occurrence's own tag (if configured) plus the master's extra
 * tags, and the master's extra frontmatter properties — via
 * processFrontMatter(), which serializes arbitrary values correctly. A
 * no-op (no extra write) if there's nothing to add.
 */
async function applyOccurrenceExtras(app: App, file: TFile, master: MasterNote, tasksTag: string | null): Promise<void> {
	const tags = tasksTag ? [tasksTag, ...master.extraTags] : master.extraTags;
	if (tags.length === 0 && Object.keys(master.extraFrontmatter).length === 0) return;

	await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
		if (tags.length > 0) fm.tags = tags;
		for (const [key, value] of Object.entries(master.extraFrontmatter)) {
			fm[key] = value;
		}
	});
}

/** Safe file name, including the date to guarantee uniqueness within the master. */
function occurrenceFileName(title: string, isoDate: string): string {
	const safeTitle = title.replace(/[\\/:*?"<>|#^[\]]/g, "").trim();
	return `${safeTitle} — ${isoDate}.md`;
}

/**
 * Entry point, called from the plugin's onLayoutReady().
 * For each master in mastersFolder, expands the RRULE and creates the
 * occurrences that don't yet exist in tasksFolder — skipping only slots
 * that are already filled. Permanently deleting an occurrence (trashFile)
 * always frees the slot up for regeneration; if that's not desired,
 * soft-delete (status: deleted) is the way to go, since it keeps the note
 * (and the slot) intact.
 *
 * `horizonDays` counts today itself: 0 disables generation entirely
 * (nothing, not even today — returns immediately), 1 generates only today,
 * 2 generates today and tomorrow, and so on.
 *
 * Never creates the masters/tasks folders — the person picks (or creates)
 * them explicitly in Settings. If either is missing, generation is skipped
 * and `missingFolders` lists which one(s), for the caller to warn about.
 */
export async function generateOccurrences(
	app: App,
	settings: WeekGridPlannerSettings,
): Promise<{ createdCount: number; missingFolders: string[] }> {
	const { mastersFolder, tasksFolder, horizonDays, fieldNames, noteTag, useTagSuffixes } = settings;
	const tagConfig = { tag: noteTag, useSuffixes: useTagSuffixes };
	const mastersTag = tagFor(tagConfig, "masters");
	const tasksTag = tagFor(tagConfig, "tasks");

	if (horizonDays === 0) return { createdCount: 0, missingFolders: [] };

	const missingFolders: string[] = [];
	if (!(app.vault.getAbstractFileByPath(mastersFolder) instanceof TFolder)) missingFolders.push(mastersFolder);
	if (!(app.vault.getAbstractFileByPath(tasksFolder) instanceof TFolder)) missingFolders.push(tasksFolder);
	if (missingFolders.length > 0) return { createdCount: 0, missingFolders };

	// See waitForFolderMetadataReady()'s doc comment — guards against the
	// mobile duplicate-generation race condition.
	await waitForFolderMetadataReady(app, [mastersFolder, tasksFolder]);

	const masters = await readMasters(app, mastersFolder, fieldNames, mastersTag);
	const existingSlots = await readExistingSlots(app, tasksFolder, fieldNames);

	const today = isoToUtcDate(formatIsoDate(new Date()));
	const horizonEnd = new Date(today);
	// horizonDays counts today itself (see doc comment above), so the range
	// only extends horizonDays - 1 days past today — the horizonDays === 0
	// case never reaches here (early return above).
	horizonEnd.setUTCDate(horizonEnd.getUTCDate() + horizonDays - 1);

	let createdCount = 0;
	const createdPaths: string[] = [];
	const invalidRuleTitles: string[] = [];
	const creationFailures: string[] = [];

	for (const master of masters) {
		let rule: RRule;
		try {
			if (master.date) {
				// Explicit reference date: build dtstart from it, instead of
				// letting the lib anchor on "now" (fragile for rules with no
				// BYDAY/BYMONTHDAY, like birthdays with plain FREQ=YEARLY).
				const options = RRule.parseString(master.rrule);
				rule = new RRule({ ...options, dtstart: isoToUtcDate(master.date) });
			} else {
				const options = RRule.parseString(master.rrule);
				if (ruleLooksRisky(options)) {
					new Notice(t("notice.riskyRule", { title: master.title }));
				}
				// Build explicitly instead of RRule.fromString(master.rrule):
				// with no DTSTART in the string, fromString() defaults dtstart
				// to `new Date()` — today's date, but also *today's current
				// wall-clock time*, in the local timezone. That time-of-day
				// then carries over to every generated occurrence, so the
				// occurrence landing on horizonEnd's date ends up timestamped
				// after horizonEnd (midnight UTC) and gets excluded from
				// `between()` — silently dropping the last day of the
				// horizon. Anchoring dtstart at `today` (already UTC
				// midnight) keeps every occurrence a clean floating day.
				rule = new RRule({ ...options, dtstart: today });
			}
		} catch (error) {
			console.warn(`Week Grid Planner: invalid RRULE in master "${master.master_id}" — skipping.`, error);
			new Notice(t("notice.invalidRrule", { title: master.title }));
			invalidRuleTitles.push(master.title);
			continue;
		}

		const occurrencesInRange = rule.between(today, horizonEnd, true);

		for (const utcOccurrence of occurrencesInRange) {
			const isoDate = utcDateToIso(utcOccurrence);

			const slotKey = `${master.master_id}::${isoDate}`;
			if (existingSlots.has(slotKey)) continue;

			const path = `${tasksFolder}/${occurrenceFileName(master.title, isoDate)}`;
			if (app.vault.getAbstractFileByPath(path)) continue;

			try {
				const file = await app.vault.create(path, buildOccurrenceContent(master, isoDate, fieldNames));
				await applyOccurrenceExtras(app, file, master, tasksTag);
				createdCount++;
				createdPaths.push(path);
			} catch (error) {
				console.error(`Week Grid Planner: failed to create occurrence "${path}".`, error);
				new Notice(t("notice.createFailed", { path }));
				creationFailures.push(path);
			}
		}
	}

	if (createdPaths.length > 0) {
		await writeLog(app, settings.activityLogEnabled, settings.activityLogPath, `Generated ${createdPaths.length} occurrence(s)`, {
			details: createdPaths,
		});
	}
	if (invalidRuleTitles.length > 0) {
		await writeLog(
			app,
			settings.activityLogEnabled,
			settings.activityLogPath,
			`${invalidRuleTitles.length} master(s) skipped — invalid RRULE`,
			{ severity: "warning", details: invalidRuleTitles },
		);
	}
	if (creationFailures.length > 0) {
		await writeLog(
			app,
			settings.activityLogEnabled,
			settings.activityLogPath,
			`Failed to create ${creationFailures.length} occurrence(s)`,
			{ severity: "error", details: creationFailures },
		);
	}

	return { createdCount, missingFolders: [] };
}
