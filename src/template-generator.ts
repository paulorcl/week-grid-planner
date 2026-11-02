import { CanonicalField } from "./fields";
import { tagFor } from "./tag-config";
import type { WeekGridPlannerSettings } from "./settings";

function buildFrontmatter(settings: WeekGridPlannerSettings, order: CanonicalField[], tag: string | null): string {
	const lines = ["---"];
	for (const field of order) {
		lines.push(`${settings.fieldNames[field]}:`);
	}
	if (tag) {
		lines.push("tags:", `  - ${tag}`);
	}
	lines.push("---", "");
	return lines.join("\n");
}

/** Every MasterNote field, empty, in the same order as a hand-written master note. */
export function buildMasterTemplate(settings: WeekGridPlannerSettings): string {
	const order: CanonicalField[] = ["title", "master_id", "date", "rrule", "color"];
	const tag = tagFor({ tag: settings.noteTag, useSuffixes: settings.useTagSuffixes }, "masters");
	return buildFrontmatter(settings, order, tag);
}

/**
 * Only the fields meant for manual entry: master_id/original_date/order
 * are plugin-managed (set on generation/creation, updated by drag-and-drop),
 * so they're left out — matches what createTask() itself writes.
 */
export function buildTaskTemplate(settings: WeekGridPlannerSettings): string {
	const order: CanonicalField[] = ["date", "status", "color"];
	const tag = tagFor({ tag: settings.noteTag, useSuffixes: settings.useTagSuffixes }, "tasks");
	return buildFrontmatter(settings, order, tag);
}
