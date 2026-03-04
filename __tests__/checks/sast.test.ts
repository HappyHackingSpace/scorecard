import { describe, expect, it } from "vitest";
import { sast } from "../../src/checks/sast";
import { makeRepoData } from "../helpers";

describe("sast", () => {
	it("returns 0 when no SAST tool detected", () => {
		const result = sast(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 10 instantly when non-CodeQL SAST tool detected (Snyk)", () => {
		const result = sast(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/sast.yml",
						content: "uses: snyk/actions/node@master",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 instantly when Semgrep detected", () => {
		const result = sast(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/sast.yml",
						content: "uses: returntocorp/semgrep-action@v1",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 instantly when Qodana detected", () => {
		const result = sast(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/qodana.yml",
						content: "uses: JetBrains/qodana-action@v2024.2",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 when CodeQL configured and all PRs have SAST checks", () => {
		const result = sast(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/codeql.yml",
						content: "uses: github/codeql-action/analyze@v3",
					},
				],
				mergedPRSASTResults: [
					{ sha: "abc123", hasSASTCheck: true },
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 when CodeQL configured and no merged PRs", () => {
		const result = sast(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/codeql.yml",
						content: "uses: github/codeql-action/analyze@v3",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("uses OSSF weighted formula for CodeQL with partial coverage", () => {
		// 1/2 PRs have SAST → sastScore = floor(10*1/2) = 5
		// weighted: floor((5*3 + 10*7) / 10) = floor(85/10) = 8
		const result = sast(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/codeql.yml",
						content: "uses: github/codeql-action/analyze@v3",
					},
				],
				mergedPRSASTResults: [
					{ sha: "abc123", hasSASTCheck: true },
					{ sha: "def456", hasSASTCheck: false },
				],
			}),
		);
		expect(result.score).toBe(8);
	});

	it("returns 7 minimum when CodeQL configured but no PRs have SAST checks", () => {
		// 0/2 PRs have SAST → sastScore = 0
		// weighted: floor((0*3 + 10*7) / 10) = floor(70/10) = 7
		const result = sast(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/codeql.yml",
						content: "uses: github/codeql-action/analyze@v3",
					},
				],
				mergedPRSASTResults: [
					{ sha: "abc123", hasSASTCheck: false },
					{ sha: "def456", hasSASTCheck: false },
				],
			}),
		);
		expect(result.score).toBe(7);
	});

	it("returns 10 for both CodeQL and other SAST (other takes priority)", () => {
		const result = sast(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/codeql.yml",
						content: "uses: github/codeql-action/analyze@v3",
					},
					{
						path: ".github/workflows/semgrep.yml",
						content: "uses: returntocorp/semgrep-action@v1",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("does not count unmerged PRs in coverage (only mergedPRSASTResults)", () => {
		const result = sast(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/codeql.yml",
						content: "uses: github/codeql-action/analyze@v3",
					},
				],
				// No mergedPRSASTResults → no merged PRs → CodeQL configured, returns 10
				mergedPRSASTResults: [],
			}),
		);
		expect(result.score).toBe(10);
	});
});
