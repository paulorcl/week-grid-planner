import { App, PluginSettingTab, SettingDefinitionItem, SettingGroupItem } from "obsidian";
import { CleanupInterval } from "./cleanup";
import { ColorPaletteEntry } from "./color-utils";
import { ColorPaletteModal } from "./color-palette-modal";
import { CANONICAL_FIELDS, DEFAULT_FIELD_NAMES, FieldNameMap, prefixedFieldName } from "./fields";
import { FieldRenameModal } from "./field-rename-modal";
import { Key, t } from "./i18n";
import type WeekGridPlannerPlugin from "./main";
import { TagRenameModal } from "./tag-rename-modal";

export type CardColorStyle = "side-border" | "fill" | "tweek";
export type CancelledTaskStyle = "strikethrough" | "red" | "both";
export type CardTextOverflow = "truncate" | "wrap";
export type AutoCleanupInterval = CleanupInterval | "never";

const FIELD_LABEL_KEYS: Record<(typeof CANONICAL_FIELDS)[number], Key> = {
	master_id: "settings.field.masterId",
	rrule: "settings.field.rrule",
	title: "settings.field.title",
	color: "settings.field.color",
	date: "settings.field.date",
	original_date: "settings.field.originalDate",
	status: "settings.field.status",
	order: "settings.field.order",
};

export interface WeekGridPlannerSettings {
	horizonDays: number;
	mastersFolder: string;
	tasksFolder: string;
	confirmHardDelete: boolean;
	autoCleanup: AutoCleanupInterval;
	// Ready for the visual-refinement phase (0.3.x) — the field already
	// exists and is applied to the card, but each mode's CSS is still basic.
	cardColorStyle: CardColorStyle;
	cancelledTaskStyle: CancelledTaskStyle;
	cardTextOverflow: CardTextOverflow;
	/** Thickness (px) of the accent stripe in "side-border" mode. */
	sideBorderThickness: number;
	/** Named colors ("work" -> "#3b82f6") a task/master's `color` property can reference instead of a raw hex. */
	colorPalette: ColorPaletteEntry[];
	/**
	 * Internal, not shown in the settings UI. False until the masters/tasks
	 * folders have been found to both exist at least once — while false,
	 * a missing folder triggers the first-run "go set this up" prompt
	 * instead of the plain "folder not found" warning. The plugin never
	 * creates these folders itself; the person picks or creates them.
	 */
	foldersConfigured: boolean;
	/** YAML keys actually in effect — what's read from and written to notes. */
	fieldNames: FieldNameMap;
	/**
	 * What's currently typed into the "Property names" settings fields, not
	 * yet applied. Kept separate from fieldNames so editing the boxes never
	 * changes what the plugin reads/writes until "Apply rename now" runs the
	 * migration and commits pendingFieldNames -> fieldNames together.
	 */
	pendingFieldNames: FieldNameMap;
	/** Convenience input for "Apply prefix to all fields below" — persisted just so the box isn't empty on reopen. */
	fieldPrefix: string;
	/** Tag (without '#') actually in effect on new notes. Empty = feature off. */
	noteTag: string;
	/** Whether the active tag is split into "{tag}/masters" / "{tag}/tasks", or used plain as "{tag}" on both. */
	useTagSuffixes: boolean;
	/**
	 * What's currently typed into the "Tag" settings fields, not yet
	 * applied. Kept separate from noteTag/useTagSuffixes for the same
	 * reason as pendingFieldNames: editing the box shouldn't change what
	 * new notes get tagged with, or leave old notes carrying a stale tag,
	 * until "Apply tag now" explicitly migrates existing notes and commits
	 * the change.
	 */
	pendingNoteTag: string;
	pendingUseTagSuffixes: boolean;
	/** Last folder used by "Generate note templates…", so the modal doesn't ask again every time. */
	templateFolder: string;
	/** Whether the activity log (occurrence generation, deletions, errors) is kept at all. */
	activityLogEnabled: boolean;
	/** Vault path of the activity log note. Only meaningful while activityLogEnabled is true. */
	activityLogPath: string;
}

export const DEFAULT_SETTINGS: WeekGridPlannerSettings = {
	horizonDays: 14,
	mastersFolder: "Masters",
	tasksFolder: "Tasks",
	confirmHardDelete: true,
	autoCleanup: "never",
	cardColorStyle: "side-border",
	cancelledTaskStyle: "both",
	cardTextOverflow: "truncate",
	sideBorderThickness: 3,
	colorPalette: [],
	foldersConfigured: false,
	fieldNames: { ...DEFAULT_FIELD_NAMES },
	pendingFieldNames: { ...DEFAULT_FIELD_NAMES },
	fieldPrefix: "wgp",
	noteTag: "wgp",
	useTagSuffixes: true,
	pendingNoteTag: "wgp",
	pendingUseTagSuffixes: true,
	templateFolder: "",
	activityLogEnabled: true,
	activityLogPath: "Week Grid Planner Log.md",
};

/** Canonical field name, as used in `fieldNames` / `pendingFieldNames`. */
type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/**
 * Control key prefix for the per-field "Property names" inputs. Those bind to
 * `settings.pendingFieldNames[field]` — a nested object — so they can't use a
 * flat `settings[key]` binding; `getControlValue`/`setControlValue` below
 * resolve this prefix by hand.
 */
const PENDING_FIELD_PREFIX = "pendingFieldNames.";

/** Settings whose change must be pushed to already-open views (Bases never re-renders for a plugin setting). */
const VIEW_REFRESH_KEYS = new Set<string>([
	"cardColorStyle",
	"sideBorderThickness",
	"cancelledTaskStyle",
	"cardTextOverflow",
]);

const requireText = (value: string): string | undefined =>
	value.trim() ? undefined : t("settings.validate.empty");

const requireInteger =
	(min: number) =>
	(value: number): string | undefined =>
		Number.isInteger(value) && value >= min ? undefined : t("settings.validate.integerMin", { min });

/**
 * Declarative settings tab (Obsidian 1.13+). Obsidian renders the page from
 * `getSettingDefinitions()`, indexes it for global settings search, and calls
 * `getControlValue` / `setControlValue` for every `control` row. There is
 * deliberately no `display()` — see the 0.3.25 changelog entry.
 */
export class WeekGridPlannerSettingTab extends PluginSettingTab {
	plugin: WeekGridPlannerPlugin;

	constructor(app: App, plugin: WeekGridPlannerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getControlValue(key: string): unknown {
		if (key.startsWith(PENDING_FIELD_PREFIX)) {
			const field = key.slice(PENDING_FIELD_PREFIX.length) as CanonicalField;
			return this.plugin.settings.pendingFieldNames[field];
		}
		return super.getControlValue(key);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const clean = typeof value === "string" ? value.trim() : value;
		if (key.startsWith(PENDING_FIELD_PREFIX)) {
			const field = key.slice(PENDING_FIELD_PREFIX.length) as CanonicalField;
			this.plugin.settings.pendingFieldNames[field] = clean as string;
		} else {
			(this.plugin.settings as unknown as Record<string, unknown>)[key] = clean;
		}
		await this.plugin.saveSettings();
		if (VIEW_REFRESH_KEYS.has(key)) this.plugin.refreshAllViews();
		// The log-path field greys out with the toggle; this re-evaluates `disabled` in place.
		if (key === "activityLogEnabled") this.refreshDomState();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const settings = this.plugin.settings;

		return [
			{
				type: "group",
				heading: t("settings.generationSection"),
				items: [
					{
						name: t("settings.horizon.name"),
						desc: t("settings.horizon.desc"),
						control: {
							type: "number",
							key: "horizonDays",
							placeholder: "14",
							defaultValue: 14,
							min: 0,
							step: 1,
							validate: requireInteger(0),
						},
					},
					{
						name: t("settings.mastersFolder.name"),
						desc: t("settings.mastersFolder.desc"),
						control: { type: "folder", key: "mastersFolder", placeholder: "Masters", validate: requireText },
					},
					{
						name: t("settings.tasksFolder.name"),
						desc: t("settings.tasksFolder.desc"),
						control: { type: "folder", key: "tasksFolder", placeholder: "Tasks", validate: requireText },
					},
				],
			},
			{
				type: "group",
				heading: t("settings.safetySection"),
				items: [
					{
						name: t("settings.confirmDelete.name"),
						desc: t("settings.confirmDelete.desc"),
						control: { type: "toggle", key: "confirmHardDelete" },
					},
					{
						name: t("settings.autoCleanup.name"),
						desc: t("settings.autoCleanup.desc"),
						control: {
							type: "dropdown",
							key: "autoCleanup",
							defaultValue: "never",
							options: {
								never: t("settings.autoCleanup.never"),
								"1m": t("cleanup.interval.1m"),
								"3m": t("cleanup.interval.3m"),
								"6m": t("cleanup.interval.6m"),
								"1y": t("cleanup.interval.1y"),
								"2y": t("cleanup.interval.2y"),
							},
						},
					},
				],
			},
			{
				type: "group",
				heading: t("settings.activityLogSection"),
				items: [
					{
						name: t("settings.activityLogEnabled.name"),
						desc: t("settings.activityLogEnabled.desc"),
						control: { type: "toggle", key: "activityLogEnabled" },
					},
					{
						// Greyed out, never hidden, while logging is off.
						name: t("settings.activityLogPath.name"),
						desc: t("settings.activityLogPath.desc"),
						control: {
							type: "text",
							key: "activityLogPath",
							placeholder: "Week Grid Planner Log.md",
							validate: requireText,
							disabled: () => !this.plugin.settings.activityLogEnabled,
						},
					},
				],
			},
			{
				type: "group",
				heading: t("settings.appearanceSection"),
				items: [
					{
						name: t("settings.cardColorStyle.name"),
						desc: t("settings.cardColorStyle.desc"),
						control: {
							type: "dropdown",
							key: "cardColorStyle",
							defaultValue: "side-border",
							options: {
								"side-border": t("settings.cardColorStyle.sideBorder"),
								fill: t("settings.cardColorStyle.fill"),
								tweek: t("settings.cardColorStyle.tweek"),
							},
						},
					},
					{
						name: t("settings.sideBorderThickness.name"),
						desc: t("settings.sideBorderThickness.desc"),
						control: {
							type: "number",
							key: "sideBorderThickness",
							placeholder: "3",
							defaultValue: 3,
							min: 1,
							step: 1,
							validate: requireInteger(1),
						},
					},
					{
						name: t("settings.colorPalette.name"),
						desc: t("settings.colorPalette.desc", { n: settings.colorPalette.length }),
						render: (setting) => {
							setting.addButton((btn) =>
								btn.setButtonText(t("settings.colorPalette.button")).onClick(() => {
									new ColorPaletteModal(this.app, this.plugin, () => this.update()).open();
								}),
							);
						},
					},
					{
						name: t("settings.cancelledTaskStyle.name"),
						desc: t("settings.cancelledTaskStyle.desc"),
						control: {
							type: "dropdown",
							key: "cancelledTaskStyle",
							defaultValue: "both",
							options: {
								strikethrough: t("settings.cancelledTaskStyle.strikethrough"),
								red: t("settings.cancelledTaskStyle.red"),
								both: t("settings.cancelledTaskStyle.both"),
							},
						},
					},
					{
						name: t("settings.cardTextOverflow.name"),
						desc: t("settings.cardTextOverflow.desc"),
						control: {
							type: "dropdown",
							key: "cardTextOverflow",
							defaultValue: "truncate",
							options: {
								truncate: t("settings.cardTextOverflow.truncate"),
								wrap: t("settings.cardTextOverflow.wrap"),
							},
						},
					},
				],
			},
			{
				type: "group",
				heading: t("settings.tagSection"),
				items: [
					{ name: "", desc: t("settings.tagSection.desc"), searchable: false },
					{
						name: t("settings.noteTag.name"),
						desc: t("settings.noteTag.desc"),
						control: { type: "text", key: "pendingNoteTag", placeholder: "wgp" },
					},
					{
						name: t("settings.useTagSuffixes.name"),
						desc: t("settings.useTagSuffixes.desc", { tag: settings.pendingNoteTag || "wgp" }),
						control: { type: "toggle", key: "pendingUseTagSuffixes" },
					},
					{
						name: t("settings.applyTag.button"),
						desc: t("settings.applyTag.desc"),
						render: (setting) => {
							setting.addButton((btn) =>
								btn
									.setButtonText(t("settings.applyTag.button"))
									.setDestructive()
									.onClick(() => new TagRenameModal(this.app, this.plugin, () => this.update()).open()),
							);
						},
					},
				],
			},
			{
				type: "group",
				heading: t("settings.propertyNamesSection"),
				items: [
					{ name: "", desc: t("settings.propertyNames.desc"), searchable: false },
					{
						// Composite row (text + button), so it renders imperatively and saves by hand.
						name: t("settings.fieldPrefix.name"),
						desc: t("settings.fieldPrefix.desc"),
						render: (setting) => {
							setting
								.addText((text) =>
									text
										.setPlaceholder("wgp")
										.setValue(this.plugin.settings.fieldPrefix)
										.onChange(async (value) => {
											this.plugin.settings.fieldPrefix = value;
											await this.plugin.saveSettings();
										}),
								)
								.addButton((btn) =>
									btn.setButtonText(t("settings.applyPrefixToAll")).onClick(async () => {
										const prefix = this.plugin.settings.fieldPrefix;
										for (const field of CANONICAL_FIELDS) {
											this.plugin.settings.pendingFieldNames[field] = prefixedFieldName(prefix, field);
										}
										await this.plugin.saveSettings();
										this.update();
									}),
								);
						},
					},
					...CANONICAL_FIELDS.map(
						(field): SettingGroupItem => ({
							name: t(FIELD_LABEL_KEYS[field]),
							control: {
								type: "text",
								key: PENDING_FIELD_PREFIX + field,
								placeholder: settings.fieldNames[field],
								validate: requireText,
							},
						}),
					),
					{
						name: t("settings.applyRename.button"),
						desc: t("settings.applyRename.desc"),
						render: (setting) => {
							setting.addButton((btn) =>
								btn
									.setButtonText(t("settings.applyRename.button"))
									.setDestructive()
									.onClick(() => new FieldRenameModal(this.app, this.plugin, () => this.update()).open()),
							);
						},
					},
				],
			},
		];
	}
}
