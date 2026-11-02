import type { App, TFile } from "obsidian";

/**
 * Canonical, internal names for every configurable frontmatter property.
 * These never change — they're how the rest of the codebase refers to "the
 * date field" etc. What changes is which YAML key each one maps to on
 * disk, via WeekGridPlannerSettings.fieldNames (see settings.ts).
 */
export const CANONICAL_FIELDS = [
	"master_id",
	"rrule",
	"title",
	"color",
	"date",
	"original_date",
	"status",
	"order",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export type FieldNameMap = Record<CanonicalField, string>;

/** Current, unprefixed names — the long-standing default, kept as-is for existing vaults. */
export const DEFAULT_FIELD_NAMES: FieldNameMap = {
	master_id: "master_id",
	rrule: "rrule",
	title: "title",
	color: "color",
	date: "date",
	original_date: "original_date",
	status: "status",
	order: "order",
};

/**
 * Default prefixed name for a field, e.g. prefixedFieldName("wgp", "original_date")
 * === "wgp_original_date". Used to bulk-fill the per-field settings when the
 * person clicks "Apply prefix to all fields below" — the separator is always
 * kept (never squashed into "wgporiginaldate"), matching the existing
 * snake_case convention.
 */
export function prefixedFieldName(prefix: string, field: CanonicalField): string {
	const trimmed = prefix.trim();
	return trimmed ? `${trimmed}_${field}` : field;
}

/**
 * A note's frontmatter as a plain string-keyed record. Obsidian types the
 * values as `any`; `unknown` makes every read narrow explicitly (and keeps
 * the review's no-unsafe-* lint rules quiet).
 */
export type Frontmatter = Record<string, unknown>;

/** The note's cached frontmatter (usually no disk access), or undefined if it has none. */
export function cachedFrontmatter(app: App, file: TFile): Frontmatter | undefined {
	return app.metadataCache.getFileCache(file)?.frontmatter;
}
