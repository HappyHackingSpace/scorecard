import { describe, expect, it } from "vitest";
import { ciTests } from "../../src/checks/ci-tests";
import { makeRepoData } from "../helpers";

describe("ciTests", () => {
	it("returns 0 when no CI detected", () => {
		const result = ciTests(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("scores based on CI check ratio", () => {
		const commits = [
			{
				message: "feat: add feature",
				committedDate: new Date().toISOString(),
				author: { login: "user", organization: null },
				associatedPullRequest: null,
				statusCheckRollup: "SUCCESS",
			},
			{
				message: "fix: bug",
				committedDate: new Date().toISOString(),
				author: { login: "user", organization: null },
				associatedPullRequest: null,
				statusCheckRollup: null,
			},
		];
		const result = ciTests(
			makeRepoData({
				recentCommits: commits,
				workflowFiles: [{ path: ".github/workflows/ci.yml", content: "name: CI" }],
			}),
		);
		expect(result.score).toBe(5);
	});
});
