import { FileSystemAdapter } from "obsidian";

export function getVaultAbsolutePath(): string | null {
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
