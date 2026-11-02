import { App, Modal, Notice, Setting } from "obsidian";
import { countTagMigration, applyTagMigration } from "./tag-backfill";
import { tagConfigChanged, tagFor, TagConfig } from "./tag-config";
import { t } from "./i18n";
import type WeekGridPlannerPlugin from "./main";

function describeTag(tag: string | null): string {
	return tag ?? t("tagRename.off");
}

/**
 * "Apply tag now": diffs the active tag config (settings.noteTag +
 * useTagSuffixes) against the pending one, shows the resulting masters/tasks
 * tag change and how many notes are affected, then — only on confirmation —
 * migrates them (removes the old tag, adds the new one, leaves every other
 * tag alone) and commits the pending config as active.
 */
export class TagRenameModal extends Modal {
	constructor(
		app: App,
		private plugin: WeekGridPlannerPlugin,
		private onDone: () => void,
	) {
		super(app);
	}

	async onOpen(): Promise<void> {
		this.setTitle(t("tagRename.modalTitle"));
		const oldConfig: TagConfig = { tag: this.plugin.settings.noteTag, useSuffixes: this.plugin.settings.useTagSuffixes };
		const newConfig: TagConfig = {
			tag: this.plugin.settings.pendingNoteTag,
			useSuffixes: this.plugin.settings.pendingUseTagSuffixes,
		};

		if (!tagConfigChanged(oldConfig, newConfig)) {
			this.contentEl.createEl("p", { text: t("tagRename.noChanges") });
			new Setting(this.contentEl).addButton((btn) =>
				btn.setButtonText(t("confirm.cancel")).onClick(() => this.close()),
			);
			return;
		}

		this.contentEl.createEl("p", { text: t("tagRename.desc") });
		const list = this.contentEl.createEl("ul");
		list.createEl("li", {
			text: `${t("tagRename.mastersLabel")}: ${describeTag(tagFor(oldConfig, "masters"))} → ${describeTag(tagFor(newConfig, "masters"))}`,
		});
		list.createEl("li", {
			text: `${t("tagRename.tasksLabel")}: ${describeTag(tagFor(oldConfig, "tasks"))} → ${describeTag(tagFor(newConfig, "tasks"))}`,
		});

		const countEl = this.contentEl.createEl("p", { text: t("fieldRename.counting") });
		const count = await countTagMigration(
			this.app,
			this.plugin.settings.mastersFolder,
			this.plugin.settings.tasksFolder,
			oldConfig,
			newConfig,
		);
		countEl.setText(t("fieldRename.confirmMessage", { n: count }));

		new Setting(this.contentEl)
			.addButton((btn) => btn.setButtonText(t("confirm.cancel")).onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText(t("tagRename.apply"))
					.setDestructive()
					.onClick(() => void this.apply(oldConfig, newConfig)),
			);
	}

	private async apply(oldConfig: TagConfig, newConfig: TagConfig) {
		this.close();
		const modified = await applyTagMigration(
			this.app,
			this.plugin.settings.mastersFolder,
			this.plugin.settings.tasksFolder,
			oldConfig,
			newConfig,
		);
		this.plugin.settings.noteTag = newConfig.tag;
		this.plugin.settings.useTagSuffixes = newConfig.useSuffixes;
		await this.plugin.saveSettings();
		new Notice(t("tagRename.done", { n: modified }));
		this.onDone();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
