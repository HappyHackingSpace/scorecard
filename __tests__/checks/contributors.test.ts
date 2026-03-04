import { describe, expect, it } from "vitest";
import { contributors } from "../../src/checks/contributors";
import { makeRepoData } from "../helpers";

describe("contributors", () => {
	it("returns 0 when no contributors with orgs", () => {
		const result = contributors(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 10 for 3+ qualifying orgs/companies", () => {
		const result = contributors(
			makeRepoData({
				contributors: [
					{ login: "user1", contributions: 10, organizations: ["google", "cncf"], company: null },
					{ login: "user2", contributions: 5, organizations: ["microsoft"], company: "Microsoft" },
					{ login: "user3", contributions: 20, organizations: [], company: "Red Hat, Inc." },
				],
			}),
		);
		// Unique: google, cncf, microsoft, red hat = 4 orgs → min(10, floor(4/3*10)) = 10
		expect(result.score).toBe(10);
	});

	it("skips contributors with fewer than 5 contributions", () => {
		const result = contributors(
			makeRepoData({
				contributors: [
					{ login: "user1", contributions: 4, organizations: ["google"], company: null },
				],
			}),
		);
		expect(result.score).toBe(0);
	});
});
