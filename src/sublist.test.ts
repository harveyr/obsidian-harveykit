import { describe, expect, test } from "@jest/globals";

import { getNewIndent } from "./sublist";

describe("get new indent", () => {
	test("no indent results in no indent", () => {
		expect(
			getNewIndent({
				lineIndent: "",
				sublistIndent: "",
				parentIndent: "",
			})
		).toBe("");
	});

	test("sublist with no indentation returns parent indent", () => {
		expect(
			getNewIndent({
				lineIndent: "",
				sublistIndent: "",
				parentIndent: "\t",
			})
		).toBe("\t");
	});

	test("sublist line indented within sublist returns parent + relative sublist indent", () => {
		expect(
			getNewIndent({
				lineIndent: "\t\t",
				sublistIndent: "\t",
				parentIndent: "\t",
			})
		).toBe("\t\t");
	});
});
