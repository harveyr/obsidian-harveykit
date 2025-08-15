import {
	App,
	Editor,
	MarkdownView,
	FuzzySuggestModal,
	MarkdownFileInfo,
} from "obsidian";

import { ripgrep, RipGrepMatch } from "./rg";
import { getVaultAbsolutePath } from "./lib";

interface TaskDescriptor {
	text: string;
	path: string;
	line: number;
}

class TaskSearchModal extends FuzzySuggestModal<TaskDescriptor> {
	private allItems: TaskDescriptor[];

	constructor(app: App, items: TaskDescriptor[]) {
		super(app);
		this.setPlaceholder("Tag combinations"); // Optional: Set a placeholder
		this.allItems = items;
	}

	getItems(): TaskDescriptor[] {
		return this.allItems;
	}

	getItemText(item: TaskDescriptor): string {
		return item.text;
	}

	onChooseItem(item: TaskDescriptor, evt: MouseEvent | KeyboardEvent) {
		console.log("todo", item);
	}
}

export function handleSearchTasks(
	editor: Editor,
	view: MarkdownView | MarkdownFileInfo
) {
	const { app } = view;

	const basePath = getVaultAbsolutePath();
	if (!basePath) {
		throw new Error(`Couldn't get vault path`);
	}

	ripgrep({ pattern: "^.*- \\[ \\] .+", basePath })
		.then((matches) => {
			const items: TaskDescriptor[] = matches.map((match) => {
				return itemFromMatch(basePath, match);
			});
			console.log("match", matches[0]);
			const modal = new TaskSearchModal(app, items);
			modal.open();
		})
		.catch(console.error);
}

function itemFromMatch(basePath: string, match: RipGrepMatch): TaskDescriptor {
	try {
		const text = match.data.lines.text.trim();
		const line = match.data.line_number;
		const path = match.data.path.text.replace(basePath + "/", "");

		return { text, path, line };
	} catch (err) {
		console.error("Failed to parse match", match);
		throw err;
	}
}
