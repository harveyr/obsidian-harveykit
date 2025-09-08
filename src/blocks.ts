import {
	App,
	Editor,
	SectionCache,
	TFile,
	MarkdownView,
	MarkdownFileInfo,
	Menu,
	Notice,
	ListItemCache,
	HeadingCache,
} from "obsidian";

import * as crypto from "crypto";
import * as notice from "./notice";

type MaybeBlock = ListItemCache | SectionCache | HeadingCache | undefined;

export function registerRightClickHandler(
	menu: Menu,
	editor: Editor,
	view: MarkdownView | MarkdownFileInfo
) {
	const { app, file } = view;
	if (!file) return;

	const block = getBlock(app, editor, file);
	if (!block) return;

	menu.addItem((item) => {
		item.setTitle("Copy link to block").onClick(() => {
			handleCommandCopyLinkToBlock(app, editor, file);
		});
	});
}

export function handleCommandCopyLinkToBlock(
	app: App,
	editor: Editor,
	file: TFile
) {
	const link = getBlockLink(app, editor, file);
	navigator.clipboard
		.writeText(link)
		.then(() => {
			new Notice("Block link copied to clipbooard");
		})
		.catch(notice.logError);
}

export function getBlockLink(app: App, editor: Editor, file: TFile): string {
	const blockID = getOrCreatBlockID(app, editor, file);
	return generateBlockLink(app, file, blockID);
}

function getOrCreatBlockID(app: App, editor: Editor, file: TFile): string {
	const block = getBlock(app, editor, file);
	if (!block) {
		throw notice.newError("No block found");
	}

	let blockID = block.id;
	if (!blockID) {
		// Add block ID to end of line
		blockID = generateBlockID();
		const lineNo = editor.getCursor().line;
		const newLineContent = editor.getLine(lineNo) + ` ^${blockID}`;
		editor.setLine(lineNo, newLineContent);
	}

	return blockID;
}

function getBlock(app: App, editor: Editor, file: TFile): MaybeBlock {
	const cursor = editor.getCursor("to");
	const fileCache = app.metadataCache.getFileCache(file);

	let block: MaybeBlock = (fileCache?.sections || []).find((section) => {
		return (
			section.position.start.line <= cursor.line &&
			section.position.end.line >= cursor.line
		);
	});

	if (block?.type === "list") {
		block = (fileCache?.listItems || []).find((item) => {
			return (
				item.position.start.line <= cursor.line &&
				item.position.end.line >= cursor.line
			);
		});
	} else if (block?.type === "heading") {
		block = fileCache?.headings?.find((heading) => {
			return heading.position.start.line === block?.position.start.line;
		});
	}

	return block;
}

function generateBlockID(): string {
	const uuid: string = crypto.randomUUID();
	return uuid.substring(0, 8);
}

function generateBlockLink(app: App, file: TFile, blockID: string): string {
	return app.fileManager.generateMarkdownLink(file, "", `#^${blockID}`);
}
