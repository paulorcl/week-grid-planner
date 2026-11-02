import { AbstractInputSuggest, App, TFolder } from "obsidian";

/** Autocomplete for an existing vault folder path, for use in settings text fields. */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(
		app: App,
		private inputEl: HTMLInputElement,
		private onChoose: (path: string) => void,
	) {
		super(app, inputEl);
	}

	getSuggestions(query: string): TFolder[] {
		const lowerCaseQuery = query.toLowerCase();
		const folders: TFolder[] = [];

		const walk = (folder: TFolder) => {
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					if (child.path.toLowerCase().includes(lowerCaseQuery)) {
						folders.push(child);
					}
					walk(child);
				}
			}
		};
		walk(this.app.vault.getRoot());

		return folders.sort((a, b) => a.path.localeCompare(b.path));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.inputEl.value = folder.path;
		this.onChoose(folder.path);
		this.close();
	}
}
