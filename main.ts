import {
	App,
	CachedMetadata,
	TFile,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	FuzzySuggestModal,
	FileSystemAdapter,
} from "obsidian";

import { exec, spawn } from "child_process";

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
					this.findAllTagCombinationsWithRipgrep().then((results) => {
						console.log("results", results);
					});
					// this.findAllTagCombinations()
					// 	.then((results) => {
					// 		console.log("results", results);
					// 		this.cache.get(cacheKey);
					// 	})
					// 	.catch(console.error);
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

	async findAllTagCombinationsWithRipgrep(): Promise<string[] | null> {
		// const tagRex = /(^|\s)#[a-zA-Z-/]+/gi;

		const basePath = this.getVaultAbsolutePath();
		if (!basePath) {
			throw new Error(`Basepath not found`);
		}

		const rgPath = "/opt/homebrew/bin/rg";
		const args = [
			"(^|\\s)#[a-zA-Z-/]+",
			"--glob",
			"*.md",
			"--json",
			basePath,
		];
		// const command = `${rgPath} '(^|\\s)#[a-zA-Z-/]+' --glob '*.md' --json .`;

		const results: Set<string> = new Set();

		function processMatchJSON(dat: any) {
			if (dat.type !== "match") {
				return;
			}

			const submatches: string[] = dat["data"]["submatches"].map((sm) => {
				return sm.match.text.trim();
			});

			results.add(submatches.join(" "));
		}

		try {
			await this.spawnRipgrepCommand(rgPath, args, processMatchJSON, {
				cwd: basePath,
			});
		} catch (err) {
			// TODO: Notice
			console.error(err);
		}

		return Array.from(results);
	}

	processRgTagOutput(output: string): string[] {
		const tagCombos: Set<string> = new Set();

		for (const line of output.split("\n")) {
			const parsed = JSON.parse(line);

			if (parsed.type !== "match") {
				continue;
			}

			const submatches = parsed["data"]["submatches"].map((sm) => {
				return sm.match.text;
			});

			tagCombos.add(submatches.join(" "));
		}

		return Array.from(tagCombos);
	}

	runCommandInDir(
		command: string,
		cwd: string
	): Promise<{ stdout: string; stderr: string }> {
		return new Promise((resolve, reject) => {
			exec(command, { cwd }, (error, stdout, stderr) => {
				if (error) {
					reject({ error, stdout, stderr });
					return;
				}
				resolve({ stdout, stderr });
			});
		});
	}

	spawnRipgrepCommand(
		rgPath: string,
		args: string[],
		onJsonParsed: (json: any) => void,
		opt: { cwd: string }
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const child = spawn(rgPath, args);
			let buffer = ""; // Buffer to hold incomplete lines

			console.log(`[${rgPath} ${args.join(" ")}] spawned.`);

			child.stdout.on("data", (data) => {
				buffer += data.toString(); // Append new data to the buffer
				let newlineIndex;

				// Process line by line
				while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
					const line = buffer.substring(0, newlineIndex).trim();

					// Remove the processed line from buffer
					buffer = buffer.substring(newlineIndex + 1);

					if (line.length > 0) {
						try {
							const json = JSON.parse(line);
							onJsonParsed(json); // Call the callback with the parsed JSON
						} catch (parseError: any) {
							reject(parseError);
						}
					}
				}
			});

			child.stderr.on("data", (data) => {
				console.error(`stderr: ${data}`);
			});

			child.on("close", (code) => {
				// Process any remaining data in the buffer after the stream closes
				if (buffer.length > 0) {
					const line = buffer.trim();
					if (line.length > 0) {
						try {
							const json = JSON.parse(line);
							onJsonParsed(json);
						} catch (parseError: any) {
							console.error(
								`Error parsing remaining JSON line: "${line}". Error: ${parseError.message}`
							);
						}
					}
				}

				if (code !== 0) {
					reject(new Error(`Process exited with code ${code}`));
				} else {
					console.log(`child process exited with code ${code}`);
					resolve();
				}
			});

			child.on("error", (err) => {
				reject(new Error(`Failed to start subprocess: ${err.message}`));
			});
		});
	}

	getVaultAbsolutePath(): string | null {
		const adapter = this.app.vault.adapter;

		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}

		// For mobile or other non-file system adapters, getBasePath() might not exist
		// or might return something else.
		console.warn(
			"Vault adapter is not a FileSystemAdapter. Cannot get absolute path."
		);
		return null;
	}
}
