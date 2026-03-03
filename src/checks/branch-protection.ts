import type { CheckResult, RepoData } from "../types";

export const branchProtection = (data: RepoData): CheckResult => {
	if (data.branchProtectionRules.length === 0) {
		return { score: 0, reason: "No branch protection rules found" };
	}

	const rule = data.branchProtectionRules[0];
	const details: string[] = [];
	let score = 0;

	if (!rule.allowsForcePushes && !rule.allowsDeletions) {
		score = 3;
		details.push("Force push and deletion disabled");
	}

	if (rule.requiresApprovingReviews && rule.requiredApprovingReviewCount >= 1) {
		score = 6;
		details.push(`Requires ${rule.requiredApprovingReviewCount} approving review(s)`);
	}

	if (rule.requiresStatusChecks) {
		score = 8;
		details.push("Requires status checks");
	}

	if (rule.requiredApprovingReviewCount >= 2 && rule.requiresCodeOwnerReviews) {
		score = 9;
		details.push("Requires 2+ reviewers and CODEOWNERS");
	}

	if (rule.dismissesStaleReviews && rule.isAdminEnforced) {
		score = 10;
		details.push("Dismisses stale reviews and enforced for admins");
	}

	return {
		score,
		reason: `Branch protection tier ${Math.ceil(score / 2)}`,
		details,
	};
};
