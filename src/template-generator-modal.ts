import { App, Modal, Notice, Setting, TFolder } from "obsidian";
import { FolderSuggest } from "./folder-suggest";
import { t } from "./i18n";
import type WeekGridPlannerPlugin from "./main";
import { buildMasterTemplate, buildTaskTemplate } from "./template-generator";

export class TemplateGeneratorModal extends Modal {
	private folder: string;

	constructor(
		app: App,
		private plugin: WeekGridPlannerPlugin,
	) {
		super(app);
		this.folder = plugin.settings.templateFolder;
	}

	onOpen(): void {
		this.setTitle(t("templateGen.modalTitle"));
		this.contentEl.createEl("p", { text: t("templateGen.desc") });

		new Setting(this.contentEl).setName(t("templateGen.folder.name")).addText((text) => {
			text
				.setPlaceholder(t("templateGen.folder.placeholder"))
				.setValue(this.folder)
				.onChange((value) => {
					this.folder = value.trim();
				});
			new FolderSuggest(this.app, text.inputEl, (path) => {
				this.folder = path;
			});
		});

		new Setting(this.contentEl).addButton((btn) =>
			btn
				.setButtonText(t("templateGen.generate"))
				.setCta()
				.onClick(() => void this.generate()),
		);
	}

	private async generate() {
		if (!this.folder) {
			new Notice(t("templateGen.noFolder"));
			return;
		}
		if (!(this.app.vault.getAbstractFileByPath(this.folder) instanceof TFolder)) {
			new Notice(t("templateGen.folderMissing", { folder: this.folder }));
			return;
		}

		this.plugin.settings.templateFolder = this.folder;
		await this.plugin.saveSettings();

		const created = await Promise.all([
			this.createIfMissing(
				`${this.folder}/${t("templateGen.masterFileName")}.md`,
				buildMasterTemplate(this.plugin.settings),
			),
			this.createIfMissing(
				`${this.folder}/${t("templateGen.taskFileName")}.md`,
				buildTaskTemplate(this.plugin.settings),
			),
		]);

		this.close();
		const skipped = created.filter((wasCreated) => !wasCreated).length;
		new Notice(skipped > 0 ? t("templateGen.doneWithSkips", { skipped }) : t("templateGen.done"));
	}

	/** Never overwrites — if a file already exists at that path, it's left untouched and reported as skipped. */
	private async createIfMissing(path: string, content: string): Promise<boolean> {
		if (this.app.vault.getAbstractFileByPath(path)) return false;
		await this.app.vault.create(path, content);
		return true;
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
