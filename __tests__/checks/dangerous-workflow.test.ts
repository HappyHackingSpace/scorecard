import { describe, expect, it } from "vitest";
import { dangerousWorkflow } from "../../src/checks/dangerous-workflow";
import { makeRepoData } from "../helpers";

describe("dangerousWorkflow", () => {
	it("returns -1 when no workflows", () => {
		const result = dangerousWorkflow(makeRepoData());
		expect(result.score).toBe(-1);
	});

	it("returns 10 for safe workflows", () => {
		const result = dangerousWorkflow(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: "on: push\njobs:\n  test:\n    runs-on: ubuntu-latest",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 0 for script injection", () => {
		const result = dangerousWorkflow(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/greet.yml",
						content:
							'on: issues\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "${{ github.event.issue.title }}"',
					},
				],
			}),
		);
		expect(result.score).toBe(0);
	});
});
