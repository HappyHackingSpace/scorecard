import { describe, expect, it } from "vitest";
import { maintained } from "../../src/checks/maintained";
import { makeRepoData } from "../helpers";

describe("maintained", () => {
	it("returns 0 for archived repos", () => {
		const result = maintained(makeRepoData({ isArchived: true }));
		expect(result.score).toBe(0);
	});

	it("scores high for recent commits", () => {
		const now = new Date();
		const commits = Array.from({ length: 10 }, (_, i) => ({
			message: `commit ${i}`,
			committedDate: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
			author: { login: "user", organization: null },
			associatedPullRequest: null,
			statusCheckRollup: null,
		}));
		const result = maintained(
			makeRepoData({ recentCommits: commits, pushedAt: now.toISOString() }),
		);
		expect(result.score).toBeGreaterThanOrEqual(3);
	});

	it("returns 2 for repos pushed within a year but no recent commits", () => {
		const result = maintained(
			makeRepoData({
				pushedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
				recentCommits: [],
			}),
		);
		expect(result.score).toBe(2);
	});

	it("returns 0 for repos with no activity over a year", () => {
		const result = maintained(
			makeRepoData({
				pushedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
				recentCommits: [],
			}),
		);
		expect(result.score).toBe(0);
	});
});
