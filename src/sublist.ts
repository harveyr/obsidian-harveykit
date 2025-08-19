import { Editor, MarkdownView, MarkdownFileInfo } from "obsidian";

/**
 * Use metadata cache.
 */
export async function handlePasteSublist(
	editor: Editor,
	view: MarkdownView | MarkdownFileInfo
) {
	const sublist = await navigator.clipboard.readText();
	const currentLine = editor.getLine(editor.getCursor().line);
	const currentIndent = getIndent(currentLine);
	const sublistLines = sublist.split("\n");
	const sublistIndent = findIndent(sublistLines);
	const newLines = sublistLines.map((line) => {
		const lineIndent = getIndent(line);
		const newIndent = getNewIndent({
			lineIndent,
			sublistIndent,
			parentIndent: currentIndent,
		});
		return `${newIndent}${line.trim()}`;
	});

	console.log("newLines", newLines);
}

interface NewIndentArg {
	lineIndent: string;
	sublistIndent: string;
	parentIndent: string;
}
export function getNewIndent(arg: NewIndentArg) {
	const { lineIndent, sublistIndent, parentIndent } = arg;

	// If neither this line nor the entire sublist has indentation, just use the parent
	if (!lineIndent || !sublistIndent) {
		return parentIndent;
	}

	// We want parent index + sublist line indented only relative to the top-most sublist line
	// const indentCount = lineIndent.length / sublistIndent.length;
	// return parentIndent + sublistIndent.repeat(indentCount);
	return parentIndent + lineIndent.replace(sublistIndent, "");
}

function findIndent(lines: string[]): string {
	const leadingWhitespaceRegex = /^(\s+)/;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const match = line.match(leadingWhitespaceRegex);
		if (match) {
			return match[1];
		}
	}
	return "";
}

function getIndent(line: string): string {
	const match = line.match(/^(\s*)/);
	if (match) {
		return match[1];
	}
	return "";
}
