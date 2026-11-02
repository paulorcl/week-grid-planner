import { App, TFile, TFolder } from "obsidian";
import { listNotesRecursively } from "./recurrence";
import { formatIsoDate } from "./schema";
import { FieldNameMap, cachedFrontmatter } from "./fields";

export type CleanupInterval = "1m" | "3m" | "6m" | "1y" | "2y";

const MONTHS_BY_INTERVAL: Record<CleanupInterval, number> = {
	"1m": 1,
	"3m": 3,
	"6m": 6,
	"1y": 12,
	"2y": 24,
};

/** Cutoff date (local, YYYY-MM-DD): today minus N months, per the chosen interval. */
function cutoffIsoDate(interval: CleanupInterval): string {
	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - MONTHS_BY_INTERVAL[interval]);
	return formatIsoDate(cutoff);
}

/**
 * Lists tasks whose `date` is older than the chosen interval, inside
 * `tasksFolder` (and subfolders) — never outside it. Based only on the
 * `date` field (not `original_date`); tasks in Someday (no `date`) never
 * show up here. Doesn't filter by `status`: an old task is a cleanup
 * candidate whether it's pending, done, or soft-deleted.
 */
export async function listOldTasks(
	app: App,
	tasksFolder: string,
	interval: CleanupInterval,
	fieldNames: FieldNameMap,
): Promise<TFile[]> {
	const folder = app.vault.getAbstractFileByPath(tasksFolder);
	if (!(folder instanceof TFolder)) return [];

	const cutoffIso = cutoffIsoDate(interval);
	const oldTasks: TFile[] = [];
	for (const file of listNotesRecursively(folder)) {
		const fm = cachedFrontmatter(app, file);
		const date = fm?.[fieldNames.date];
		if (typeof date !== "string" || !date) continue;
		if (date < cutoffIso) oldTasks.push(file);
	}
	return oldTasks;
}

/** Permanently deletes (respecting the Obsidian trash setting) the given files. */
export async function deleteFiles(
	app: App,
	files: TFile[],
): Promise<{ deletedPaths: string[]; failedPaths: string[] }> {
	const deletedPaths: string[] = [];
	const failedPaths: string[] = [];
	for (const file of files) {
		try {
			const path = file.path;
			await app.fileManager.trashFile(file);
			deletedPaths.push(path);
		} catch (error) {
			console.error(`Week Grid Planner: failed to delete old task "${file.path}".`, error);
			failedPaths.push(file.path);
		}
	}
	return { deletedPaths, failedPaths };
}
