import { describe, expect, it } from "vitest";
import { fuzzing } from "../../src/checks/fuzzing";
import { makeRepoData } from "../helpers";

describe("fuzzing", () => {
	it("returns 0 when no fuzzing detected", () => {
		const result = fuzzing(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 10 when fuzzing found in workflows", () => {
		const result = fuzzing(
			makeRepoData({
				workflowFiles: [
					{ path: ".github/workflows/fuzz.yml", content: "uses: google/oss-fuzz" },
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 when fuzz files in tree", () => {
		const result = fuzzing(makeRepoData({ treeFiles: ["tests/fuzz_test.go"] }));
		expect(result.score).toBe(10);
	});
});
