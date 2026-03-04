import type { CheckResult, RepoData } from "../types";

export const ciTests = (data: RepoData): CheckResult => {
	// OSSF: uses Check Runs API per merged PR head SHA, pattern-matched for CI names
	const ciResults = data.mergedPRCIResults;

	if (ciResults.length === 0) {
		return { score: -1, reason: "No merged PRs found to evaluate" };
	}

	const withCI = ciResults.filter((r) => r.hasCIChecks).length;
	const total = ciResults.length;
	const score = Math.min(Math.floor((10 * withCI) / total), 10);

	return {
		score,
		reason: `${withCI}/${total} merged PRs have CI tests`,
	};
};
