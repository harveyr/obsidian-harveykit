import {
	App,
	CachedMetadata,
	TFile,
	Editor,
	MarkdownView,
	Notice,
	FuzzySuggestModal,
	FileSystemAdapter,
	MarkdownFileInfo,
} from "obsidian";

import { spawn } from "child_process";

interface TagComboListItem {
	joinedTags: string;
}

type RipGrepMatch = {
	type: string;
	data: {
		path: {
			text: string;
		};
		lines: {
			text: string;
		};
		line_number: number;
		absolute_offset: number;
		submatches: Array<{
			match: {
				text: string;
			};
			start: number;
			end: number;
		}>;
	};
};

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

/**
 * Find the tags in the given file path using Obsidian's metadata cache.
 */
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

/**
 * Find the tags in the given file path using Obsidian's metadata cache.
 */
function getTagsCombosForFile(app: App, file: TFile): Set<string> {
	const fileCache: CachedMetadata | null =
		app.metadataCache.getFileCache(file);

	return findTagCombosInFileCache(fileCache);
}

function findTagCombosInFileCache(
	fileCache: CachedMetadata | null
): Set<string> {
	if (!fileCache) {
		return new Set();
	}

	function normalizeTag(tag: string): string {
		return tag[0] === "#" ? tag : `#${tag}`;
	}

	const allCombos: Set<string> = new Set();

	// TODO: filter
	allCombos.add(fileCache.frontmatter?.tags?.map(normalizeTag).join(" "));

	const tagsByLine: Map<number, Set<string>> = new Map();
	fileCache.tags?.forEach((tag) => {
		const startLine = tag.position.start.line;
		const endLine = tag.position.end.line;

		for (let lineNo = startLine; lineNo <= endLine; lineNo++) {
			const lineTags = tagsByLine.get(lineNo) || new Set();
			lineTags.add(tag.tag);
			tagsByLine.set(lineNo, lineTags);
		}
	});

	for (const tags of tagsByLine.values()) {
		const combo = Array.from(tags).map(normalizeTag).join(" ");
		allCombos.add(combo);
	}

	return allCombos;
}

export function exploreTagsSpike(
	editor: Editor,
	view: MarkdownView | MarkdownFileInfo
) {
	const { app } = view;
	// const abstractFile = app.vault.getAbstractFileByPath("Scratchpad.md");
	// if (!abstractFile) {
	// 	throw new Error(`Couldn't find Scratchpad`);
	// }

	// const meta = app.metadataCache.getFileCache(abstractFile);
	// console.log("meta", meta);

	const combos = getTagsCombosForFilePath(app, "Scratchpad.md");

	console.log("combos", combos);
}

export function exploreTagsV2(
	editor: Editor,
	view: MarkdownView | MarkdownFileInfo
) {
	const cacheKey = "tag-combos";
	const results = this.cache.get(cacheKey);
	if (!results) {
		findAllTagCombinationsWithRipgrep()
			.then((results) => {
				const items: TagComboListItem[] = [];

				if (results) {
					for (const joinedTags of results) {
						items.push({ joinedTags });
					}
					const modal = new TagComboSearchModal(this.app, items);
					modal.open();
				}
			})
			.catch(console.error);
	}
}

/**
 * Use metadata cache.
 */
export function exploreTagsV3(
	editor: Editor,
	view: MarkdownView | MarkdownFileInfo
) {
	console.log("Explore tags v3");
	const { app } = view;
	const { vault } = app;
	const files = vault.getMarkdownFiles();

	const allCombos: Set<string> = new Set();

	files.forEach((file) => {
		getTagsCombosForFile(app, file).forEach((combo) => {
			allCombos.add(combo);
		});
	});

	const items: TagComboListItem[] = [];
	allCombos.forEach((combo) => {
		items.push({ joinedTags: combo });
	});

	const modal = new TagComboSearchModal(app, items);
	modal.open();
}

export function exploreTagsV1(
	editor: Editor,
	view: MarkdownView | MarkdownFileInfo
): void {
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
		items.push({
			joinedTags,
		});
	}
	const modal = new TagComboSearchModal(app, items);
	modal.open();
}

async function findAllTagCombinationsWithRipgrep(): Promise<string[] | null> {
	const basePath = getVaultAbsolutePath();
	if (!basePath) {
		throw new Error(`Basepath not found`);
	}

	// TODO: make this a config variable
	const rgPath = "/opt/homebrew/bin/rg";
	const args = ["(^|\\s)#[a-zA-Z-/]+", "--glob", "*.md", "--json", basePath];

	const results: Set<string> = new Set();

	function processMatchJSON(dat: any) {
		if (dat.type !== "match") {
			return;
		}

		const match: RipGrepMatch = dat as RipGrepMatch;

		const submatches: string[] = match["data"]["submatches"].map((sm) => {
			return sm.match.text.trim();
		});

		results.add(submatches.join(" "));
	}

	try {
		await spawnRipgrepCommand(rgPath, args, processMatchJSON, {
			cwd: basePath,
		});
	} catch (err) {
		// TODO: Notice
		console.error(err);
	}

	return Array.from(results);
}

function spawnRipgrepCommand(
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

function getVaultAbsolutePath(): string | null {
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
