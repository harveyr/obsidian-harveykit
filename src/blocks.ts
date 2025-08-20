import {
	App,
	Editor,
	SectionCache,
	TFile,
	MarkdownView,
	MarkdownFileInfo,
	Menu,
	Notice,
} from "obsidian";

import * as crypto from "crypto";
import * as notice from "./notice";

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

function getBlock(
	app: App,
	editor: Editor,
	file: TFile
): SectionCache | undefined {
	const cursor = editor.getCursor("to");
	const fileCache = app.metadataCache.getFileCache(file);

	const block = (fileCache?.sections || []).find((section) => {
		return (
			section.position.start.line <= cursor.line &&
			section.position.end.line >= cursor.line
		);
	});

	return block;
}

function generateBlockID(): string {
	const uuid: string = crypto.randomUUID();
	return uuid.substring(0, 8);
}

function generateBlockLink(app: App, file: TFile, blockID: string): string {
	return app.fileManager.generateMarkdownLink(file, "", `#^${blockID}`);
}
