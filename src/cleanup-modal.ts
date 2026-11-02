import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { ConfirmModal } from "./confirm-modal";
import { CleanupInterval, deleteFiles, listOldTasks } from "./cleanup";
import { Key, t } from "./i18n";
import { writeLog } from "./logger";
import type WeekGridPlannerPlugin from "./main";

const OPTIONS: { value: CleanupInterval; key: Key }[] = [
	{ value: "1m", key: "cleanup.interval.1m" },
	{ value: "3m", key: "cleanup.interval.3m" },
	{ value: "6m", key: "cleanup.interval.6m" },
	{ value: "1y", key: "cleanup.interval.1y" },
	{ value: "2y", key: "cleanup.interval.2y" },
];

/** "Delete old tasks…" modal: pick the interval, then confirm with the real count before deleting. */
export class DeleteOldTasksModal extends Modal {
	private interval: CleanupInterval = "1y";

	constructor(
		app: App,
		private plugin: WeekGridPlannerPlugin,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(t("cleanup.modalTitle"));
		this.contentEl.createEl("p", { text: t("cleanup.desc") });

		new Setting(this.contentEl).setName(t("cleanup.interval.name")).addDropdown((dropdown) => {
			for (const option of OPTIONS) dropdown.addOption(option.value, t(option.key));
			dropdown.setValue(this.interval);
			dropdown.onChange((value) => {
				this.interval = value as CleanupInterval;
			});
		});

		new Setting(this.contentEl).addButton((btn) =>
			btn
				.setButtonText(t("cleanup.continue"))
				.setCta()
				.onClick(() => void this.continueToConfirm()),
		);
	}

	private async continueToConfirm() {
		const chosenInterval = this.interval;
		const files = await listOldTasks(this.app, this.plugin.settings.tasksFolder, chosenInterval, this.plugin.settings.fieldNames);
		this.close();

		if (files.length === 0) {
			new Notice(t("cleanup.noneFound"));
			return;
		}

		const intervalLabel = t(OPTIONS.find((o) => o.value === chosenInterval)!.key);
		new ConfirmModal(
			this.app,
			t("cleanup.confirmTitle"),
			t("cleanup.confirmMessage", { n: files.length, interval: intervalLabel }),
			() => void this.deleteAll(files),
		).open();
	}

	private async deleteAll(files: TFile[]) {
		const { deletedPaths, failedPaths } = await deleteFiles(this.app, files);
		new Notice(t("cleanup.deleted", { n: deletedPaths.length }));
		if (deletedPaths.length > 0) {
			await writeLog(
				this.app,
				this.plugin.settings.activityLogEnabled,
				this.plugin.settings.activityLogPath,
				`Deleted ${deletedPaths.length} old task(s) (manual)`,
				{ details: deletedPaths },
			);
		}
		if (failedPaths.length > 0) {
			await writeLog(
				this.app,
				this.plugin.settings.activityLogEnabled,
				this.plugin.settings.activityLogPath,
				`Failed to delete ${failedPaths.length} old task(s) (manual)`,
				{ severity: "error", details: failedPaths },
			);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
