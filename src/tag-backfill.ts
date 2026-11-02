import { App, TFile, TFolder } from "obsidian";
import { listNotesRecursively } from "./recurrence";
import { TagConfig, tagFor } from "./tag-config";
import { Frontmatter, cachedFrontmatter } from "./fields";

function normalizeTags(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string" && value.trim()) return [value.trim()];
	return [];
}

/** How many notes in `folder` (recursive) don't already have `tag` in their `tags` list. */
export async function countUntagged(app: App, folder: string, tag: string): Promise<number> {
	const folderObj = app.vault.getAbstractFileByPath(folder);
	if (!(folderObj instanceof TFolder)) return 0;

	let count = 0;
	for (const file of listNotesRecursively(folderObj)) {
		const fm = cachedFrontmatter(app, file);
		if (!normalizeTags(fm?.tags).includes(tag)) count++;
	}
	return count;
}

/**
 * Appends `tag` to the `tags` frontmatter list of every note in `folder`
 * (recursive) that doesn't already have it — never overwrites existing
 * tags, never removes anything. Used by "Add tags to existing notes…",
 * which only fills gaps under the currently active tag config. Returns how
 * many files were modified.
 */
export async function backfillTag(app: App, folder: string, tag: string): Promise<number> {
	const folderObj = app.vault.getAbstractFileByPath(folder);
	if (!(folderObj instanceof TFolder)) return 0;

	let modifiedCount = 0;
	for (const file of listNotesRecursively(folderObj)) {
		const fm = cachedFrontmatter(app, file);
		if (normalizeTags(fm?.tags).includes(tag)) continue;

		try {
			await app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
				const current = normalizeTags(frontmatter.tags);
				if (!current.includes(tag)) {
					frontmatter.tags = [...current, tag];
				}
			});
			modifiedCount++;
		} catch (error) {
			console.error(`Week Grid Planner: failed to tag "${file.path}".`, error);
		}
	}
	return modifiedCount;
}

/** Notes in `folder` that would change if `oldTag` were swapped for `newTag` (either is null = "no tag"). */
async function filesNeedingRetag(app: App, folder: string, oldTag: string | null, newTag: string | null): Promise<TFile[]> {
	if (oldTag === newTag) return [];
	const folderObj = app.vault.getAbstractFileByPath(folder);
	if (!(folderObj instanceof TFolder)) return [];

	const result: TFile[] = [];
	for (const file of listNotesRecursively(folderObj)) {
		const fm = cachedFrontmatter(app, file);
		const current = normalizeTags(fm?.tags);
		const hasOld = oldTag !== null && current.includes(oldTag);
		const hasNew = newTag !== null && current.includes(newTag);
		if (hasOld || (newTag !== null && !hasNew)) result.push(file);
	}
	return result;
}

async function retagFiles(app: App, files: TFile[], oldTag: string | null, newTag: string | null): Promise<number> {
	let modifiedCount = 0;
	for (const file of files) {
		try {
			await app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
				let tags = normalizeTags(frontmatter.tags);
				if (oldTag !== null) tags = tags.filter((existing) => existing !== oldTag);
				if (newTag !== null && !tags.includes(newTag)) tags = [...tags, newTag];
				if (tags.length > 0) frontmatter.tags = tags;
				else delete frontmatter.tags;
			});
			modifiedCount++;
		} catch (error) {
			console.error(`Week Grid Planner: failed to retag "${file.path}".`, error);
		}
	}
	return modifiedCount;
}

/**
 * How many notes in mastersFolder+tasksFolder would be touched by switching
 * from `oldConfig` to `newConfig` — either had the old tag (to be removed)
 * or is missing the new one (to be added).
 */
export async function countTagMigration(
	app: App,
	mastersFolder: string,
	tasksFolder: string,
	oldConfig: TagConfig,
	newConfig: TagConfig,
): Promise<number> {
	const mastersFiles = await filesNeedingRetag(app, mastersFolder, tagFor(oldConfig, "masters"), tagFor(newConfig, "masters"));
	const tasksFiles = await filesNeedingRetag(app, tasksFolder, tagFor(oldConfig, "tasks"), tagFor(newConfig, "tasks"));
	return mastersFiles.length + tasksFiles.length;
}

/**
 * Migrates every note in mastersFolder+tasksFolder from `oldConfig`'s tag(s)
 * to `newConfig`'s — removes the old tag where present, adds the new one
 * where missing, leaves every other tag on the note untouched. Returns how
 * many files were modified.
 */
export async function applyTagMigration(
	app: App,
	mastersFolder: string,
	tasksFolder: string,
	oldConfig: TagConfig,
	newConfig: TagConfig,
): Promise<number> {
	const oldMasters = tagFor(oldConfig, "masters");
	const newMasters = tagFor(newConfig, "masters");
	const oldTasks = tagFor(oldConfig, "tasks");
	const newTasks = tagFor(newConfig, "tasks");

	const mastersFiles = await filesNeedingRetag(app, mastersFolder, oldMasters, newMasters);
	const tasksFiles = await filesNeedingRetag(app, tasksFolder, oldTasks, newTasks);

	const mastersModified = await retagFiles(app, mastersFiles, oldMasters, newMasters);
	const tasksModified = await retagFiles(app, tasksFiles, oldTasks, newTasks);
	return mastersModified + tasksModified;
}
