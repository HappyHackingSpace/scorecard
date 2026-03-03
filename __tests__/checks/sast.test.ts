import { describe, expect, it } from "vitest";
import { sast } from "../../src/checks/sast";
import { makeRepoData } from "../helpers";

describe("sast", () => {
	it("returns 0 when no SAST tool detected", () => {
		const result = sast(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 10 when CodeQL found", () => {
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

	it("returns 10 when Semgrep found", () => {
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
});
