import { describe, expect, it } from "vitest";
import { ciTests } from "../../src/checks/ci-tests";
import { makeRepoData } from "../helpers";

describe("ciTests", () => {
	it("returns -1 when no merged PRs", () => {
		const result = ciTests(makeRepoData());
		expect(result.score).toBe(-1);
	});

	it("scores based on CI check ratio of merged PRs", () => {
		const result = ciTests(
			makeRepoData({
				mergedPRCIResults: [
					{ sha: "abc", hasCIChecks: true },
					{ sha: "def", hasCIChecks: false },
				],
			}),
		);
		expect(result.score).toBe(5);
	});

	it("returns 10 when all merged PRs have CI checks", () => {
		const result = ciTests(
			makeRepoData({
				mergedPRCIResults: [
					{ sha: "abc", hasCIChecks: true },
					{ sha: "def", hasCIChecks: true },
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 0 when no merged PRs have CI checks", () => {
		const result = ciTests(
			makeRepoData({
				mergedPRCIResults: [
					{ sha: "abc", hasCIChecks: false },
					{ sha: "def", hasCIChecks: false },
				],
			}),
		);
		expect(result.score).toBe(0);
	});
});
