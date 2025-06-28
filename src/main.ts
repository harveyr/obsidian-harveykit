import { Editor, MarkdownView, Plugin, MarkdownFileInfo } from "obsidian";

import { exploreTagsSpike, exploreTagsV3 } from "./tag-explorer";

// Remember to rename these classes and interfaces!

export default class HarveyKitPlugin extends Plugin {
	private cache: Map<string, string> = new Map();

	async onload() {
		// This adds an editor command that can perform some operation on the current editor instance

		// TODO: update cache when file changes
		// this.registerEvent(
		// 	this.app.vault.on("modify", (file) => {
		// 		// Invalidate cache when a file is modified
		// 		if (file instanceof TFile) {
		// 			this.fileContentCache.delete(file.path);
		// 		}
		// 	})
		// );

		this.addCommand({
			id: "harvey-kit-explore-tags-spike",
			name: "Explore tags: spike",
			editorCallback: exploreTagsSpike,
		});

		this.addCommand({
			id: "harvey-kit-explore-tags",
			name: "Explore tags",
			editorCallback: exploreTagsV3,
		});

		// this.addCommand({
		// 	id: "harvey-kit-explore-tags",
		// 	name: "Explore tags v1",
		// 	editorCallback: exploreTagsV1,
		// });

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
	}

	onunload() {}
}
