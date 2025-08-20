import { App, Editor, Notice } from "obsidian";
import { VolatileCache } from "./cache";
import { pasteSublist } from "./sublist";
import { getBlockLink } from "./blocks";

export async function handleMarkSublistForMove(
	app: App,
	editor: Editor,
	cache: VolatileCache
) {
	const selections = editor.listSelections();
	if (selections.length !== 1) {
		new Notice(
			`Error: You have ${selections.length} selections (there can be only ONE ⚔️)`
		);
		return;
	}

	const selection = selections[0];
	if (selection.head.ch === 0 && selection.head.line > 0) {
		selection.head.line--;
		selection.head.ch = editor.getLine(selection.head.line).length;
	}

	cache.sublistMarkedFile = app.workspace.getActiveFile();
	cache.sublistMarkedRegion = selections[0];
	cache.sublistMarkedTime = Date.now();

	const text = editor.getSelection();
	if (!text.trim().startsWith("- ")) {
		new Notice(`Warning: selection does not appear to be a sublist`);
	}

	const lineCount = text.split("\n").length;
	new Notice(`Marked ${lineCount} lines for move`);
}

export async function handleMoveMarkedSublist(
	app: App,
	editor: Editor,
	cache: VolatileCache
) {
	const destFile = app.workspace.getActiveFile();
	if (!destFile) {
		new Notice("Error: No file open");
		return;
	}
	const destLocation = editor.getCursor();

	const sourceRegion = cache.sublistMarkedRegion;
	const markedTime = cache.sublistMarkedTime;
	const sourceFile = cache.sublistMarkedFile;

	if (!sourceRegion) {
		new Notice("Error: No marked region");
		return;
	}
	if (!markedTime) {
		new Notice("Error: No marked time (programming bug)");
		return;
	}
	if (!sourceFile) {
		new Notice("Error: No marked file (programming bug)");
		return;
	}

	const secondsSinceMark = Math.round((Date.now() - markedTime) / 1000);
	console.log("Mark age: %s", secondsSinceMark);
	if (secondsSinceMark > 120) {
		new Notice(
			`Not moving sublist because it's been too long (${secondsSinceMark} seconds)`
		);
		return;
	}

	const leaf = app.workspace.getLeaf();
	await leaf.openFile(sourceFile);

	// Get the sublist text
	const sublistText = editor.getRange(sourceRegion.anchor, sourceRegion.head);

	// Paste it into the new spot
	await leaf.openFile(destFile);
	editor.setSelection(destLocation);
	pasteSublist(editor, sublistText);

	// Get the link to the block
	editor.setSelection(destLocation);
	const blockLink = getBlockLink(app, editor, destFile);

	const sublistFirstLineIndent = sublistText.split("\n")[0].split("-")[0];
	const replacementLine = `${sublistFirstLineIndent}- (Moved to ${blockLink})`;

	// Replace the original location with the link
	await leaf.openFile(sourceFile);
	editor.replaceRange(
		replacementLine,
		sourceRegion.anchor,
		sourceRegion.head
	);
}
