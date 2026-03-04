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
						associatedPullRequest: { merged: true, headSHA: "a1", reviews: 2, labels: [] },
						statusCheckRollup: "SUCCESS",
					},
					{
						message: "fix: also reviewed",
						committedDate: new Date().toISOString(),
						author: { login: "user2", organization: null },
						associatedPullRequest: { merged: true, headSHA: "a1", reviews: 1, labels: [] },
						statusCheckRollup: "SUCCESS",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 0 when no commits are reviewed", () => {
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
		expect(result.score).toBe(0);
	});

	it("uses floor division like OSSF (2/3 = 6 not 7)", () => {
		const result = codeReview(
			makeRepoData({
				recentCommits: [
					{
						message: "reviewed 1",
						committedDate: new Date().toISOString(),
						author: { login: "user", organization: null },
						associatedPullRequest: { merged: true, headSHA: "a1", reviews: 1, labels: [] },
						statusCheckRollup: "SUCCESS",
					},
					{
						message: "reviewed 2",
						committedDate: new Date().toISOString(),
						author: { login: "user", organization: null },
						associatedPullRequest: { merged: true, headSHA: "a1", reviews: 1, labels: [] },
						statusCheckRollup: "SUCCESS",
					},
					{
						message: "unreviewed",
						committedDate: new Date().toISOString(),
						author: { login: "user", organization: null },
						associatedPullRequest: { merged: true, headSHA: "a1", reviews: 0, labels: [] },
						statusCheckRollup: "SUCCESS",
					},
				],
			}),
		);
		expect(result.score).toBe(6);
	});

	it("skips approved bot commits but counts unapproved bot commits", () => {
		const result = codeReview(
			makeRepoData({
				recentCommits: [
					{
						message: "reviewed human",
						committedDate: new Date().toISOString(),
						author: { login: "user", organization: null },
						associatedPullRequest: { merged: true, headSHA: "a1", reviews: 1, labels: [] },
						statusCheckRollup: "SUCCESS",
					},
					{
						message: "approved bot (skipped)",
						committedDate: new Date().toISOString(),
						author: { login: "dependabot[bot]", organization: null },
						associatedPullRequest: { merged: true, headSHA: "a1", reviews: 1, labels: [] },
						statusCheckRollup: "SUCCESS",
					},
					{
						message: "unapproved bot (counts against)",
						committedDate: new Date().toISOString(),
						author: { login: "renovate[bot]", organization: null },
						associatedPullRequest: null,
						statusCheckRollup: null,
					},
				],
			}),
		);
		expect(result.score).toBe(5);
	});

	it("returns -1 when all commits are approved bots", () => {
		const result = codeReview(
			makeRepoData({
				recentCommits: [
					{
						message: "bot commit",
						committedDate: new Date().toISOString(),
						author: { login: "dependabot[bot]", organization: null },
						associatedPullRequest: { merged: true, headSHA: "a1", reviews: 1, labels: [] },
						statusCheckRollup: "SUCCESS",
					},
				],
			}),
		);
		expect(result.score).toBe(-1);
	});

	it("detects Prow-reviewed PRs via lgtm+approved labels", () => {
		const result = codeReview(
			makeRepoData({
				recentCommits: [
					{
						message: "Merge pull request #123",
						committedDate: new Date().toISOString(),
						author: { login: "user", organization: null },
						associatedPullRequest: {
							merged: true,
							headSHA: "a1",
							reviews: 0,
							labels: ["lgtm", "approved", "size/L"],
						},
						statusCheckRollup: "SUCCESS",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("detects Gerrit-reviewed commits via message", () => {
		const result = codeReview(
			makeRepoData({
				recentCommits: [
					{
						message:
							"Fix bug\n\nReviewed-on: https://review.example.com/c/123\nReviewed-by: reviewer@example.com",
						committedDate: new Date().toISOString(),
						author: { login: "user", organization: null },
						associatedPullRequest: null,
						statusCheckRollup: null,
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("detects Phabricator-reviewed commits via message", () => {
		const result = codeReview(
			makeRepoData({
				recentCommits: [
					{
						message: "Fix bug\n\nDifferential Revision: https://phabricator.example.com/D12345",
						committedDate: new Date().toISOString(),
						author: { login: "user", organization: null },
						associatedPullRequest: null,
						statusCheckRollup: null,
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});
});
