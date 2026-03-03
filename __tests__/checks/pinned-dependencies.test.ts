import { describe, expect, it } from "vitest";
import { pinnedDependencies } from "../../src/checks/pinned-dependencies";
import { makeRepoData } from "../helpers";

describe("pinnedDependencies", () => {
	it("returns -1 when no dependencies", () => {
		const result = pinnedDependencies(makeRepoData());
		expect(result.score).toBe(-1);
	});

	it("returns 10 when all pinned to SHA", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: "uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("deducts for tag-based references", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: [
							"uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29",
							"uses: actions/setup-node@v4",
						].join("\n"),
					},
				],
			}),
		);
		expect(result.score).toBe(5);
	});
});
