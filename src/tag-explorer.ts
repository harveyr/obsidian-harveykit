import {
	App,
	CachedMetadata,
	TFile,
	Editor,
	MarkdownView,
	Notice,
	FuzzySuggestModal,
	MarkdownFileInfo,
} from "obsidian";

interface TagComboListItem {
	joinedTags: string;
}

/**
 * Use metadata cache.
 */
export function handleExploreTagsCommand(
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
function getTagsCombosForFile(app: App, file: TFile): Set<string> {
	const fileCache: CachedMetadata | null =
		app.metadataCache.getFileCache(file);

	return findTagCombosFromFileCache(fileCache);
}

function findTagCombosFromFileCache(
	fileCache: CachedMetadata | null
): Set<string> {
	if (!fileCache) {
		return new Set();
	}

	const allCombos: Set<string> = new Set();

	const frontmatterTags = normalizeTags(fileCache.frontmatter?.tags);
	if (frontmatterTags.length) {
		allCombos.add(frontmatterTags.join(" "));
	}

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

function normalizeTag(tag: string): string {
	return tag[0] === "#" ? tag : `#${tag}`;
}

function normalizeTags(tags: any): string[] {
	if (!Array.isArray(tags)) {
		console.error("Not an array:", tags);
		return [];
	}

	return tags
		.filter((tag: string) => {
			if (!tag.trim()) {
				return false;
			}
			return true;
		})
		.map(normalizeTag);
}
