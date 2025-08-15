import {
	App,
	Editor,
	MarkdownView,
	FuzzySuggestModal,
	MarkdownFileInfo,
} from "obsidian";

interface SearchItem {
	text: string;
	line: number;
}

class SearchModal extends FuzzySuggestModal<SearchItem> {
	private allItems: SearchItem[];
	private editor: Editor;

	constructor(app: App, editor: Editor, items: SearchItem[]) {
		super(app);
		this.editor = editor;
		this.allItems = items;
	}

	getItems(): SearchItem[] {
		return this.allItems;
	}

	getItemText(item: SearchItem): string {
		return `${item.line + 1}. ${item.text}`;
	}

	onChooseItem(item: SearchItem, evt: MouseEvent | KeyboardEvent) {
		const editor = this.editor;
		const { line } = item;
		const startSelection = { line, ch: 0 };
		const lineLength = editor.getLine(line).length;

		editor.setSelection(startSelection, { line, ch: lineLength });
		editor.scrollIntoView(
			{
				from: startSelection,
				to: startSelection,
			},
			true
		);
	}
}

export function handleSearchLines(
	editor: Editor,
	view: MarkdownView | MarkdownFileInfo
) {
	const { app } = view;

	const allLines = editor.getValue().split("\n");
	const items: SearchItem[] = allLines.map((text, line) => {
		return { text, line };
	});

	const modal = new SearchModal(app, editor, items);
	modal.open();
}
