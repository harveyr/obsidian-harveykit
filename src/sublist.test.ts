import { describe, expect, test } from "@jest/globals";

import { getNewIndent } from "./sublist";

describe("get new indent", () => {
	test("adds 1 + 2 to equal 3", () => {
		expect(
			getNewIndent({
				lineIndent: "",
				sublistIndent: "",
				parentIndent: "",
			})
		).toBe("");
	});
});
