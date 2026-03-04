import { describe, expect, it } from "vitest";
import { packaging } from "../../src/checks/packaging";
import { makeRepoData } from "../helpers";

describe("packaging", () => {
	it("returns -1 when no publishing detected (inconclusive)", () => {
		const result = packaging(makeRepoData());
		expect(result.score).toBe(-1);
	});

	it("returns -1 when publishing workflow found but no successful runs", () => {
		const result = packaging(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/publish.yml",
						content: "run: npm publish",
					},
				],
			}),
		);
		expect(result.score).toBe(-1);
	});

	it("returns 10 when npm publish found and workflow has run successfully", () => {
		const result = packaging(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/publish.yml",
						content: "run: npm publish",
					},
				],
				successfulWorkflowPaths: [".github/workflows/publish.yml"],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 when docker push found and workflow has run successfully", () => {
		const result = packaging(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/docker.yml",
						content: "uses: docker/build-push-action@v5",
					},
				],
				successfulWorkflowPaths: [".github/workflows/docker.yml"],
			}),
		);
		expect(result.score).toBe(10);
	});
});
