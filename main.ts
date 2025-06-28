import {
	App,
	CachedMetadata,
	TFile,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	FuzzySuggestModal,
} from "obsidian";

// Remember to rename these classes and interfaces!

function getTagsForFilePath(app: App, filePath: string): string[] {
	const abstractFile = app.vault.getAbstractFileByPath(filePath);

	if (abstractFile instanceof TFile) {
		const fileCache: CachedMetadata | null =
			app.metadataCache.getFileCache(abstractFile);

		const tags = fileCache?.tags?.map((tag) => {
			return tag.tag;
		});
		if (!tags) {
			return [];
		}

		tags.sort();

		return tags;
	}
	return [];
}

interface TagComboListItem {
	joinedTags: string;
	paths: string[];
}

export class TagComboSearchModal extends FuzzySuggestModal<TagComboListItem> {
	private allItems: TagComboListItem[];

	constructor(app: App, items: TagComboListItem[]) {
		super(app);
		this.setPlaceholder("Tag combinations"); // Optional: Set a placeholder
		this.allItems = items;
	}

	getItems(): TagComboListItem[] {
		return this.allItems;
	}

	getItemText(item: TagComboListItem): string {
		return item.joinedTags;
	}

	onChooseItem(item: TagComboListItem, evt: MouseEvent | KeyboardEvent) {
		const tags = item.joinedTags.split(" ");
		const searchStr = tags
			.map((tag) => {
				return `tag:${tag}`;
			})
			.join(" ");
		navigator.clipboard.writeText(searchStr);

		new Notice("Copied search string to clipboard", 3000);

		// https://discord.com/channels/686053708261228577/840286264964022302/1274754359841783889
		const searchPlugin = (this.app as any).internalPlugins.getPluginById(
			"global-search"
		);
		searchPlugin.instance.openGlobalSearch(searchStr);
	}
}

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
			name: "Explore tags: v2 spike",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				// const { app } = view;
				// const { vault } = app;

				const cacheKey = "tag-combos";
				const results = this.cache.get(cacheKey);
				if (!results) {
					this.findAllTagCombinations()
						.then((results) => {
							console.log("results", results);
							this.cache.get(cacheKey);
						})
						.catch(console.error);
				}
			},
		});

		this.addCommand({
			id: "harvey-kit-explore-tags",
			name: "Explore tags",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const { app } = view;
				const { vault } = app;
				const files = vault.getFiles();

				const allTagsMap = new Map<string, Set<string>>();

				files.forEach((file) => {
					const tags = getTagsForFilePath(app, file.path);
					const joined = tags.join(" ");
					const tagMap = allTagsMap.get(joined) || new Set();
					tagMap.add(file.path);
					allTagsMap.set(joined, tagMap);
				});

				const items: TagComboListItem[] = [];
				for (const joinedTags of allTagsMap.keys()) {
					const paths = allTagsMap.get(joinedTags);
					if (paths) {
						items.push({
							joinedTags,
							paths: Array.from(paths),
						});
					}
				}
				const modal = new TagComboSearchModal(app, items);
				modal.open();
			},
		});
		this.addCommand({
			id: "harvey-kit-move-tags-to-properties",
			name: "Move selected tags to properties",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (!view.file) {
					console.error("No view.file");
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
						console.log("hi");
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

	async findAllTagCombinations(): Promise<string[]> {
		const tagRex = /(^|\s)#[a-zA-Z-/]+/gi;

		const mdFiles = this.app.vault.getMarkdownFiles();
		const results: Set<string> = new Set();

		for (const file of mdFiles) {
			const content = await this.app.vault.cachedRead(file);
			const matches = content.match(tagRex);

			if (matches) {
				results.add(
					matches
						.map((match) => {
							return match.trim();
						})
						.join(" ")
				);
			}
		}
		return Array.from(results);
	}
}
