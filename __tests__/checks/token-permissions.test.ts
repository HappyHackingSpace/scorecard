import { describe, expect, it } from "vitest";
import { tokenPermissions } from "../../src/checks/token-permissions";
import { makeRepoData } from "../helpers";

describe("tokenPermissions", () => {
	it("returns -1 when no workflows", () => {
		const result = tokenPermissions(makeRepoData());
		expect(result.score).toBe(-1);
	});

	it("returns 10 for read-all permissions", () => {
		const result = tokenPermissions(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: "permissions: read-all\njobs:\n  test:",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 0 when no permissions block at any level (OSSF behavior)", () => {
		const result = tokenPermissions(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: "name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest",
					},
				],
			}),
		);
		expect(result.score).toBe(0);
	});

	it("returns 5 when job-level permissions exist but no top-level", () => {
		const result = tokenPermissions(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: "name: CI\njobs:\n  test:\n    permissions:\n      contents: read",
					},
				],
			}),
		);
		expect(result.score).toBe(5);
	});
});
