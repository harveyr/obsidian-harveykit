import { App, Editor, SectionCache, TFile, Notice } from "obsidian";

import * as crypto from "crypto";

export function handleCommandCopyLinkToBlock(
	app: App,
	editor: Editor,
	file: TFile
) {
	const block = getBlock(app, editor, file);
	if (!block) {
		console.error("No block found");
		return;
	}

	let blockID = block.id;
	if (!blockID) {
		// Add block ID to end of line
		blockID = generateBlockID();
		const lineNo = editor.getCursor().line;
		const newLineContent = editor.getLine(lineNo) + ` ^${blockID}`;
		editor.setLine(lineNo, newLineContent);
	}

	const link = generateBlockLink(app, file, blockID);
	navigator.clipboard
		.writeText(link)
		.then(() => {
			new Notice("Block link copied to clipbooard");
		})
		.catch((err) => {
			new Notice(`${err}`);
			console.error(err);
		});
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
