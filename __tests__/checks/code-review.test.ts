import { describe, expect, it } from "vitest";
import { codeReview } from "../../src/checks/code-review";
import { makeRepoData } from "../helpers";

describe("codeReview", () => {
	it("returns -1 when no commits", () => {
		const result = codeReview(makeRepoData());
		expect(result.score).toBe(-1);
	});

	it("returns 10 when all reviewed", () => {
		const result = codeReview(
			makeRepoData({
				recentCommits: [
					{
						message: "feat: reviewed",
						committedDate: new Date().toISOString(),
						author: { login: "user", organization: null },
						associatedPullRequest: { merged: true, reviews: 2 },
						statusCheckRollup: "SUCCESS",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("deducts for unreviewed commits", () => {
		const result = codeReview(
			makeRepoData({
				recentCommits: [
					{
						message: "unreviewed commit",
						committedDate: new Date().toISOString(),
						author: { login: "user", organization: null },
						associatedPullRequest: null,
						statusCheckRollup: null,
					},
				],
			}),
		);
		expect(result.score).toBe(3);
	});
});
