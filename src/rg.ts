import { spawn } from "child_process";

const RgPath = "/opt/homebrew/bin/rg";
const DefaultArgs = ["--glob", "*.md", "--json"];

export type RipGrepMatch = {
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

// async function findAllTagCombinationsWithRipgrep(): Promise<string[] | null> {
// 	const basePath = getVaultAbsolutePath();
// 	if (!basePath) {
// 		throw new Error(`Basepath not found`);
// 	}

// 	// TODO: make this a config variable
// 	const rgPath = "/opt/homebrew/bin/rg";
// 	const args = ["(^|\\s)#[a-zA-Z-/]+", "--glob", "*.md", "--json", basePath];

// 	const results: Set<string> = new Set();

// 	function processMatchJSON(dat: any) {
// 		if (dat.type !== "match") {
// 			return;
// 		}

// 		const match: RipGrepMatch = dat as RipGrepMatch;

// 		const submatches: string[] = match["data"]["submatches"].map((sm) => {
// 			return sm.match.text.trim();
// 		});

// 		results.add(submatches.join(" "));
// 	}

// 	try {
// 		await spawnRipgrepCommand(rgPath, args, processMatchJSON, {
// 			cwd: basePath,
// 		});
// 	} catch (err) {
// 		// TODO: Notice
// 		console.error(err);
// 	}

// 	return Array.from(results);
// }

interface RgArg {
	pattern: string;
	basePath: string;
}

export async function ripgrep(args: RgArg): Promise<RipGrepMatch[]> {
	const matches: RipGrepMatch[] = [];

	function processMatchJSON(dat: any) {
		if (dat.type !== "match") {
			return;
		}

		const match: RipGrepMatch = dat as RipGrepMatch;

		matches.push(match);
	}

	const { pattern, basePath } = args;
	const rgArgs = [pattern, ...DefaultArgs, basePath];

	await spawnRipgrepCommand(RgPath, rgArgs, processMatchJSON, {
		// TODO: how to use basePath the best way
		cwd: basePath,
	});

	return matches
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
