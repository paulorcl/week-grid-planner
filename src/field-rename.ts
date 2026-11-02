import { App, TFile, TFolder } from "obsidian";
import { CANONICAL_FIELDS, CanonicalField, FieldNameMap, Frontmatter, cachedFrontmatter } from "./fields";
import { listNotesRecursively } from "./recurrence";

export interface FieldRenamePlan {
	field: CanonicalField;
	oldName: string;
	newName: string;
}

/** Which canonical fields actually differ between the active and pending name maps. */
export function diffFieldNames(current: FieldNameMap, pending: FieldNameMap): FieldRenamePlan[] {
	const changes: FieldRenamePlan[] = [];
	for (const field of CANONICAL_FIELDS) {
		if (current[field] !== pending[field]) {
			changes.push({ field, oldName: current[field], newName: pending[field] });
		}
	}
	return changes;
}

/**
 * .md files in mastersFolder + tasksFolder (recursive), deduplicated — a
 * master_id/original_date rename has to touch both folders in the same
 * pass, since a stale key in only one of them would break the slot match.
 * Scoped to exactly these two folders, nothing else in the vault.
 */
async function collectFiles(app: App, mastersFolder: string, tasksFolder: string): Promise<TFile[]> {
	const seen = new Set<string>();
	const files: TFile[] = [];
	for (const folderPath of [mastersFolder, tasksFolder]) {
		const folder = app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) continue;
		for (const file of listNotesRecursively(folder)) {
			if (seen.has(file.path)) continue;
			seen.add(file.path);
			files.push(file);
		}
	}
	return files;
}

/** How many files in mastersFolder+tasksFolder actually have at least one of the old keys — shown before the person confirms. */
export async function countAffectedFiles(
	app: App,
	mastersFolder: string,
	tasksFolder: string,
	changes: FieldRenamePlan[],
): Promise<number> {
	const files = await collectFiles(app, mastersFolder, tasksFolder);
	let count = 0;
	for (const file of files) {
		const fm = cachedFrontmatter(app, file);
		if (fm && changes.some((c) => c.oldName in fm)) count++;
	}
	return count;
}

/**
 * Renames frontmatter keys in every note under mastersFolder+tasksFolder
 * according to `changes`. Only touches keys actually present in a given
 * note — never invents a new key on a note that didn't have the old one.
 * Returns how many files were modified.
 */
export async function renameFields(
	app: App,
	mastersFolder: string,
	tasksFolder: string,
	changes: FieldRenamePlan[],
): Promise<number> {
	const files = await collectFiles(app, mastersFolder, tasksFolder);
	let modifiedCount = 0;
	for (const file of files) {
		const cache = cachedFrontmatter(app, file);
		if (!cache) continue;
		const relevant = changes.filter((c) => c.oldName !== c.newName && c.oldName in cache);
		if (relevant.length === 0) continue;

		try {
			await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
				for (const { oldName, newName } of relevant) {
					fm[newName] = fm[oldName];
					delete fm[oldName];
				}
			});
			modifiedCount++;
		} catch (error) {
			console.error(`Week Grid Planner: failed to rename fields in "${file.path}".`, error);
		}
	}
	return modifiedCount;
}
