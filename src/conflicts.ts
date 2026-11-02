import { App, TFile, TFolder } from "obsidian";
import { listNotesRecursively } from "./recurrence";
import { FieldNameMap, cachedFrontmatter } from "./fields";

export interface MasterIdConflict {
	masterId: string;
	files: TFile[];
}

/**
 * Finds master notes in `mastersFolder` (and subfolders) that share the
 * same `master_id`. Two masters with the same id make the "is this slot
 * filled?" check in generateOccurrences() ambiguous — an occurrence
 * generated for one master can silently make the other's matching slot
 * look already filled, with no error or warning. Only reports ids used by
 * more than one file.
 */
export async function findDuplicateMasterIds(
	app: App,
	mastersFolder: string,
	fieldNames: FieldNameMap,
): Promise<MasterIdConflict[]> {
	const folder = app.vault.getAbstractFileByPath(mastersFolder);
	if (!(folder instanceof TFolder)) return [];

	const filesById = new Map<string, TFile[]>();
	for (const file of listNotesRecursively(folder)) {
		const fm = cachedFrontmatter(app, file);
		const masterId = fm?.[fieldNames.master_id];
		if (typeof masterId !== "string" || !masterId) continue;
		const list = filesById.get(masterId) ?? [];
		list.push(file);
		filesById.set(masterId, list);
	}

	const conflicts: MasterIdConflict[] = [];
	for (const [masterId, files] of filesById) {
		if (files.length > 1) conflicts.push({ masterId, files });
	}
	return conflicts;
}
