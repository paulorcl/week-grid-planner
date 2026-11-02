import { App, Modal, Notice, Setting } from "obsidian";
import { countAffectedFiles, diffFieldNames, FieldRenamePlan, renameFields } from "./field-rename";
import { t } from "./i18n";
import type WeekGridPlannerPlugin from "./main";

/**
 * "Apply rename now": diffs settings.fieldNames (active) against
 * pendingFieldNames (what's in the settings text boxes), shows exactly
 * which keys change and how many files in the masters/tasks folders are
 * affected, then — only on explicit confirmation — rewrites those files
 * and commits pendingFieldNames as the new active fieldNames.
 */
export class FieldRenameModal extends Modal {
	constructor(
		app: App,
		private plugin: WeekGridPlannerPlugin,
		private onDone: () => void,
	) {
		super(app);
	}

	async onOpen(): Promise<void> {
		this.setTitle(t("fieldRename.modalTitle"));
		const changes = diffFieldNames(this.plugin.settings.fieldNames, this.plugin.settings.pendingFieldNames);

		if (changes.length === 0) {
			this.contentEl.createEl("p", { text: t("fieldRename.noChanges") });
			new Setting(this.contentEl).addButton((btn) =>
				btn.setButtonText(t("confirm.cancel")).onClick(() => this.close()),
			);
			return;
		}

		this.contentEl.createEl("p", { text: t("fieldRename.desc") });
		const list = this.contentEl.createEl("ul");
		for (const change of changes) {
			list.createEl("li", { text: `${change.oldName} → ${change.newName}` });
		}

		const countEl = this.contentEl.createEl("p", { text: t("fieldRename.counting") });
		const count = await countAffectedFiles(
			this.app,
			this.plugin.settings.mastersFolder,
			this.plugin.settings.tasksFolder,
			changes,
		);
		countEl.setText(t("fieldRename.confirmMessage", { n: count }));

		new Setting(this.contentEl)
			.addButton((btn) => btn.setButtonText(t("confirm.cancel")).onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText(t("fieldRename.apply"))
					.setDestructive()
					.onClick(() => void this.apply(changes)),
			);
	}

	private async apply(changes: FieldRenamePlan[]) {
		this.close();
		const modified = await renameFields(
			this.app,
			this.plugin.settings.mastersFolder,
			this.plugin.settings.tasksFolder,
			changes,
		);
		this.plugin.settings.fieldNames = { ...this.plugin.settings.pendingFieldNames };
		await this.plugin.saveSettings();
		this.plugin.refreshAllViews();
		new Notice(t("fieldRename.done", { n: modified }));
		this.onDone();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
