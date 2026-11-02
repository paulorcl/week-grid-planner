import { App, TFile, TFolder } from "obsidian";
import { listNotesRecursively } from "./recurrence";
import { formatIsoDate, STATUS_CANCELLED, STATUS_DELETED, STATUS_DONE } from "./schema";
import { FieldNameMap, Frontmatter, cachedFrontmatter } from "./fields";

/**
 * "Overdue" tasks: have a `date` before today, aren't done (status !== "done"),
 * cancelled (status !== "cancelled"), or soft-deleted (status !== "deleted"),
 * inside `tasksFolder` (and subfolders) — never outside it. Tasks in Someday
 * (no `date`) never count as overdue.
 */
async function listOverdueTasks(
	app: App,
	tasksFolder: string,
	fieldNames: FieldNameMap,
): Promise<{ file: TFile; date: string; order: number }[]> {
	const folder = app.vault.getAbstractFileByPath(tasksFolder);
	if (!(folder instanceof TFolder)) return [];

	const todayIso = formatIsoDate(new Date());
	const overdue: { file: TFile; date: string; order: number }[] = [];
	for (const file of listNotesRecursively(folder)) {
		const fm = cachedFrontmatter(app, file);
		const date = fm?.[fieldNames.date];
		if (typeof date !== "string" || !date || date >= todayIso) continue;
		const status = fm?.[fieldNames.status];
		if (status === STATUS_DONE || status === STATUS_DELETED || status === STATUS_CANCELLED) {
			continue;
		}
		const order = fm?.[fieldNames.order];
		overdue.push({ file, date, order: typeof order === "number" ? order : 0 });
	}
	// Most overdue first (earliest date), and within the same day keeps the
	// order they already had — so the final sequence at the destination makes
	// sense, instead of following the "random" folder-traversal order.
	overdue.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));
	return overdue;
}

/**
 * Highest `order` value already in use among notes in `tasksFolder` that
 * match `isDestination` (ignores soft-deleted ones, which don't show up in
 * the view). Returns -1 if none is found (first position becomes 0).
 */
async function highestOrderAtDestination(
	app: App,
	tasksFolder: string,
	fieldNames: FieldNameMap,
	isDestination: (fm: Record<string, unknown>) => boolean,
): Promise<number> {
	const folder = app.vault.getAbstractFileByPath(tasksFolder);
	if (!(folder instanceof TFolder)) return -1;

	let highest = -1;
	for (const file of listNotesRecursively(folder)) {
		const fm = cachedFrontmatter(app, file);
		if (!fm || fm[fieldNames.status] === STATUS_DELETED || !isDestination(fm)) continue;
		const order = fm[fieldNames.order];
		if (typeof order === "number" && order > highest) highest = order;
	}
	return highest;
}

/**
 * Moves all overdue tasks (see listOverdueTasks) to today, reindexing
 * `order` so they land in the last positions of the day (after whatever was
 * already in "today"), in the order computed by listOverdueTasks.
 */
export async function bringOverdueToToday(app: App, tasksFolder: string, fieldNames: FieldNameMap): Promise<number> {
	const overdue = await listOverdueTasks(app, tasksFolder, fieldNames);
	if (overdue.length === 0) return 0;

	const todayIso = formatIsoDate(new Date());
	let nextOrder =
		(await highestOrderAtDestination(app, tasksFolder, fieldNames, (fm) => fm[fieldNames.date] === todayIso)) + 1;

	for (const { file } of overdue) {
		const order = nextOrder++;
		await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			fm[fieldNames.date] = todayIso;
			fm[fieldNames.order] = order;
		});
	}
	return overdue.length;
}

/**
 * Moves all overdue tasks (see listOverdueTasks) to Someday (removes
 * `date`), reindexing `order` so they land in the last positions of
 * Someday, in the order computed by listOverdueTasks.
 */
export async function bringOverdueToSomeday(app: App, tasksFolder: string, fieldNames: FieldNameMap): Promise<number> {
	const overdue = await listOverdueTasks(app, tasksFolder, fieldNames);
	if (overdue.length === 0) return 0;

	let nextOrder = (await highestOrderAtDestination(app, tasksFolder, fieldNames, (fm) => !fm[fieldNames.date])) + 1;

	for (const { file } of overdue) {
		const order = nextOrder++;
		await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			delete fm[fieldNames.date];
			fm[fieldNames.order] = order;
		});
	}
	return overdue.length;
}
