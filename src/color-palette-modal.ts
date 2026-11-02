import { App, Modal, Setting } from "obsidian";
import { t } from "./i18n";
import type WeekGridPlannerPlugin from "./main";

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Lives in its own modal (rather than inline in Settings) so the settings
 * page stays a fixed size regardless of how many colors get added. Edits
 * apply immediately per-row — unlike the field/tag rename flows, there's no
 * existing-note migration involved: removing or renaming a palette entry
 * just means any note referencing that name stops resolving to a color
 * (same as an unmatched name always has), nothing on disk needs rewriting.
 */
export class ColorPaletteModal extends Modal {
	private newName = "";
	private newHex = "";

	constructor(
		app: App,
		private plugin: WeekGridPlannerPlugin,
		private onChange: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(t("colorPalette.modalTitle"));
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		this.contentEl.createEl("p", { text: t("colorPalette.desc") });

		const palette = this.plugin.settings.colorPalette;
		palette.forEach((entry, index) => {
			const row = new Setting(this.contentEl);
			const swatchEl = row.nameEl.createSpan({ cls: "wgp-color-swatch" });
			swatchEl.style.backgroundColor = entry.hex;
			row.nameEl.createSpan({ text: entry.name });

			row.addText((text) =>
				text
					.setPlaceholder("#3b82f6")
					.setValue(entry.hex)
					.onChange(async (value) => {
						const trimmed = value.trim();
						if (!HEX_PATTERN.test(trimmed)) return;
						entry.hex = trimmed;
						swatchEl.style.backgroundColor = trimmed;
						await this.plugin.saveSettings();
						this.plugin.refreshAllViews();
						this.onChange();
					}),
			);
			row.addExtraButton((btn) =>
				btn
					.setIcon("trash")
					.setTooltip(t("colorPalette.remove"))
					.onClick(async () => {
						palette.splice(index, 1);
						await this.plugin.saveSettings();
						this.plugin.refreshAllViews();
						this.onChange();
						this.render();
					}),
			);
		});

		new Setting(this.contentEl)
			.setName(t("colorPalette.addName"))
			.addText((text) =>
				text.setPlaceholder(t("colorPalette.namePlaceholder")).onChange((value) => {
					this.newName = value.trim();
				}),
			)
			.addText((text) => text.setPlaceholder("#3b82f6").onChange((value) => (this.newHex = value.trim())))
			.addButton((btn) =>
				btn
					.setButtonText(t("colorPalette.add"))
					.setCta()
					.onClick(async () => {
						if (!this.newName || !HEX_PATTERN.test(this.newHex)) return;
						const existing = palette.find((entry) => entry.name === this.newName);
						if (existing) existing.hex = this.newHex;
						else palette.push({ name: this.newName, hex: this.newHex });
						this.newName = "";
						this.newHex = "";
						await this.plugin.saveSettings();
						this.plugin.refreshAllViews();
						this.onChange();
						this.render();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
