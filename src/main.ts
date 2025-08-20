import { Editor, MarkdownView, Plugin, MarkdownFileInfo } from "obsidian";

import { handleExploreTagsCommand } from "./tag-explorer";
import { handleSearchTasks } from "./tasks";
import { handleSearchLines } from "./line-search";
import { handlePasteSublist } from "./sublist";
import * as sublistMove from "./sublist-move";

import {
	handleCommandCopyLinkToBlock,
	registerRightClickHandler,
} from "./blocks";

import { VolatileCache } from "./cache";

export default class HarveyKitPlugin extends Plugin {
	private cache: VolatileCache;

	async onload() {
		this.cache = {};

		this.registerEvent(
			this.app.workspace.on("editor-menu", registerRightClickHandler)
		);

		/**
		 * Explore tag combinations across the vault.
		 */
		this.addCommand({
			id: "harvey-kit-explore-tags",
			name: "Explore tags",
			editorCallback: handleExploreTagsCommand,
		});

		/**
		 * Move the tags on the cursor's line into the file's YAML properties
		 * (old-school tags -> new-school).
		 */
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

		/**
		 * Copy a link to the current line via a block ID.
		 */
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

		/**
		 * Search all tasks across the vault.
		 */
		this.addCommand({
			id: "harveykit-search-tasks",
			name: "Search tasks",
			editorCallback: handleSearchTasks,
		});

		/**
		 * Logseq-esque searching of the lines in the current file.
		 */
		this.addCommand({
			id: "harveykit-search-lines",
			name: "Search lines in file",
			editorCallback: handleSearchLines,
		});

		this.addCommand({
			id: "harveykit-paste-sublist",
			name: "Paste clipboard as sublist",
			editorCallback: handlePasteSublist,
		});

		this.addCommand({
			id: "harveykit-mark-sublist-for-move",
			name: "Mark sublist for move",
			editorCallback: (editor, view) => {
				sublistMove.handleMarkSublistForMove(
					this.app,
					editor,
					this.cache
				);
			},
		});

		this.addCommand({
			id: "harveykit-move-marked-sublist",
			name: "Move marked sublist",
			editorCallback: (editor, view) => {
				sublistMove.handleMoveMarkedSublist(
					this.app,
					editor,
					this.cache
				);
			},
		});
	}

	onunload() {}
}
