import type { CheckResult, RepoData } from "../types";

const MIN_COMMITS_PER_ORG = 5;
const TARGET_ORGS = 3;

export const contributors = (data: RepoData): CheckResult => {
	const orgCommitCounts = new Map<string, number>();

	for (const commit of data.recentCommits) {
		const org = commit.author.organization;
		if (org) {
			orgCommitCounts.set(org, (orgCommitCounts.get(org) ?? 0) + 1);
		}
	}

	const qualifyingOrgs = [...orgCommitCounts.entries()].filter(
		([, count]) => count >= MIN_COMMITS_PER_ORG,
	);

	const score = Math.min(10, Math.round((qualifyingOrgs.length / TARGET_ORGS) * 10));

	return {
		score,
		reason: `${qualifyingOrgs.length} organization(s) with ${MIN_COMMITS_PER_ORG}+ commits`,
		details: qualifyingOrgs.map(([org, count]) => `${org}: ${count} commits`),
	};
};
