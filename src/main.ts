import { Editor, MarkdownView, Plugin, MarkdownFileInfo } from "obsidian";

import { handleExploreTagsCommand } from "./tag-explorer";

import {
	handleCommandCopyLinkToBlock,
	registerRightClickHandler,
} from "./blocks";

// Remember to rename these classes and interfaces!

export default class HarveyKitPlugin extends Plugin {
	private cache: Map<string, string> = new Map();

	async onload() {
		this.registerEvent(
			this.app.workspace.on("editor-menu", registerRightClickHandler)
		);

		this.addCommand({
			id: "harvey-kit-explore-tags",
			name: "Explore tags",
			editorCallback: handleExploreTagsCommand,
		});

		this.addCommand({
			id: "harvey-kit-move-tags-to-properties",
			name: "Move selected tags to properties",
			editorCallback: (
				editor: Editor,
				view: MarkdownView | MarkdownFileInfo
			) => {
				if (!view.file) {
					console.error("No view.file");
					return;
				}
				if (!view.editor) {
					console.error("No view.editor");
					return;
				}

				let input = editor.getSelection();
				let isFromSelection = true;
				if (!input.length) {
					input = view.editor.getLine(view.editor.getCursor().line);
					isFromSelection = false;
				}

				const tagsToMove = input
					.split(" ")
					.map((tag) => {
						tag = tag.trim();
						if (!tag) {
							return "";
						}

						if (tag[0] !== "#") {
							return "";
						}

						return tag.slice(1);
					})
					.filter((tag) => {
						return tag.length > 2;
					});

				view.app.fileManager.processFrontMatter(
					view.file,
					(frontmatter) => {
						console.log("tags to add", tagsToMove);
						console.log(frontmatter);

						const currentTags = frontmatter.tags || [];

						const newTags = Array.from(
							new Set([...currentTags, ...tagsToMove])
						);
						newTags.sort();

						frontmatter.tags = newTags;
					}
				);

				if (isFromSelection) {
					editor.replaceSelection("");
				} else {
					editor.exec("deleteLine");
				}
			},
		});

		this.addCommand({
			id: "harveykit-copy-link-to-block",
			name: "Copy link to current block",
			editorCallback: (editor, view) => {
				// TODO: what is editorCheckCallback?

				const file = view.file;
				if (!file) {
					return;
				}

				handleCommandCopyLinkToBlock(view.app, editor, file);
			},
		});
	}

	onunload() {}
}
