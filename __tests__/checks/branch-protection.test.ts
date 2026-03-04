import { describe, expect, it } from "vitest";
import { branchProtection } from "../../src/checks/branch-protection";
import { makeRepoData } from "../helpers";

describe("branchProtection", () => {
	it("returns -1 when no rules (inconclusive)", () => {
		const result = branchProtection(makeRepoData());
		expect(result.score).toBe(-1);
	});

	it("returns 3 for basic protection", () => {
		const result = branchProtection(
			makeRepoData({
				branchProtectionRules: [
					{
						allowsForcePushes: false,
						allowsDeletions: false,
						requiresApprovingReviews: false,
						requiredApprovingReviewCount: 0,
						requiresStatusChecks: false,
						requiresCodeOwnerReviews: false,
						dismissesStaleReviews: false,
						isAdminEnforced: false,
					},
				],
			}),
		);
		expect(result.score).toBe(3);
	});

	it("returns 10 for full protection", () => {
		const result = branchProtection(
			makeRepoData({
				branchProtectionRules: [
					{
						allowsForcePushes: false,
						allowsDeletions: false,
						requiresApprovingReviews: true,
						requiredApprovingReviewCount: 2,
						requiresStatusChecks: true,
						requiresCodeOwnerReviews: true,
						dismissesStaleReviews: true,
						isAdminEnforced: true,
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});
});
