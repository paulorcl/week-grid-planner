import { App, Modal } from "obsidian";
import { MasterIdConflict } from "./conflicts";
import { t } from "./i18n";

/** Lists duplicate master_id groups found by findDuplicateMasterIds, with clickable links to each file. */
export class MasterConflictsModal extends Modal {
	constructor(
		app: App,
		private conflicts: MasterIdConflict[],
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(t("conflicts.modalTitle"));
		this.contentEl.createEl("p", { text: t("conflicts.desc") });

		for (const conflict of this.conflicts) {
			this.contentEl.createEl("h4", { text: conflict.masterId });
			const list = this.contentEl.createEl("ul");
			for (const file of conflict.files) {
				const item = list.createEl("li");
				const link = item.createEl("a", { text: file.path, href: "#" });
				link.addEventListener("click", (ev) => {
					ev.preventDefault();
					this.close();
					void this.app.workspace.openLinkText(file.path, "", false);
				});
			}
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
