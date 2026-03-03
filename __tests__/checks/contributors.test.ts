import { describe, expect, it } from "vitest";
import { contributors } from "../../src/checks/contributors";
import { makeRepoData } from "../helpers";

describe("contributors", () => {
	it("returns 0 when no org contributors", () => {
		const result = contributors(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 10 for 3+ qualifying orgs", () => {
		const commits = [
			...Array.from({ length: 5 }, () => ({
				message: "a",
				committedDate: new Date().toISOString(),
				author: { login: "u1", organization: "org1" },
				associatedPullRequest: null,
				statusCheckRollup: null,
			})),
			...Array.from({ length: 5 }, () => ({
				message: "b",
				committedDate: new Date().toISOString(),
				author: { login: "u2", organization: "org2" },
				associatedPullRequest: null,
				statusCheckRollup: null,
			})),
			...Array.from({ length: 5 }, () => ({
				message: "c",
				committedDate: new Date().toISOString(),
				author: { login: "u3", organization: "org3" },
				associatedPullRequest: null,
				statusCheckRollup: null,
			})),
		];
		const result = contributors(makeRepoData({ recentCommits: commits }));
		expect(result.score).toBe(10);
	});
});
