/**
 * Pure ordering rules for multi-card selection and multi-card moves — no DOM,
 * no Obsidian — so they can be reasoned about (and tested) on their own.
 */

/**
 * The cards from `anchorPath` to `targetPath`, inclusive, in list order (the
 * click can be above or below the anchor). If there is no usable anchor in
 * this list — nothing selected yet, or the anchor sits in another column —
 * the range is just the clicked card.
 */
export function rangeBetween(listPaths: string[], anchorPath: string | null, targetPath: string): string[] {
	const anchor = anchorPath === null ? -1 : listPaths.indexOf(anchorPath);
	const target = listPaths.indexOf(targetPath);
	if (anchor === -1 || target === -1) return [targetPath];
	return listPaths.slice(Math.min(anchor, target), Math.max(anchor, target) + 1);
}

/**
 * `existing` with every path in `inserted` first taken out, then `inserted`
 * (in the order given) spliced in at `position` of what remains. A position
 * past the end appends. This is the order the destination list gets rewritten
 * in after a drop, whether one card or several are being moved.
 */
export function insertPaths(existing: string[], inserted: string[], position: number): string[] {
	const moving = new Set(inserted);
	const rest = existing.filter((path) => !moving.has(path));
	rest.splice(position, 0, ...inserted);
	return rest;
}
