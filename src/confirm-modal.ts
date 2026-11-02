import { App, Modal, Setting } from "obsidian";
import { t } from "./i18n";

/** Simple "are you sure?" modal with Confirm/Cancel buttons. */
export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private message: string,
		private onConfirm: () => void,
		private confirmLabel: string = t("confirm.delete"),
		private warning: boolean = true,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.title);
		this.contentEl.createEl("p", { text: this.message });

		new Setting(this.contentEl)
			.addButton((btn) => btn.setButtonText(t("confirm.cancel")).onClick(() => this.close()))
			.addButton((btn) => {
				btn.setButtonText(this.confirmLabel).onClick(() => {
					this.close();
					this.onConfirm();
				});
				if (this.warning) btn.setDestructive();
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
