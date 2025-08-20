import { Notice } from "obsidian";

export function logError(err: Error) {
	new Notice(`${err}`);
	console.error(err);
}

export function logErrorMessage(message: string) {
	console.error(message);
	new Notice(`Error: ${message}`);
}

export function newError(message: string): Error {
	logErrorMessage(message);
	return new Error(message);
}
