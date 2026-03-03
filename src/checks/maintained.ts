import type { CheckResult, RepoData } from "../types";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export const maintained = (data: RepoData): CheckResult => {
	if (data.isArchived) {
		return { score: 0, reason: "Repository is archived" };
	}

	const now = Date.now();
	const pushedAt = new Date(data.pushedAt).getTime();
	const daysSincePush = (now - pushedAt) / (24 * 60 * 60 * 1000);

	const recentCommits = data.recentCommits.filter(
		(c) => now - new Date(c.committedDate).getTime() < NINETY_DAYS_MS,
	);

	if (recentCommits.length >= 1 && daysSincePush <= 90) {
		const commitScore = Math.min(recentCommits.length, 30) / 3;
		const issueScore = Math.min(data.issueActivityCount, 10) / 10;
		const score = Math.min(10, Math.round(commitScore + issueScore));
		return {
			score,
			reason: `${recentCommits.length} commit(s) in last 90 days`,
			details: [`Last push: ${Math.round(daysSincePush)} days ago`],
		};
	}

	if (daysSincePush <= 365) {
		return {
			score: 2,
			reason: `Last push ${Math.round(daysSincePush)} days ago, limited recent activity`,
		};
	}

	return {
		score: 0,
		reason: `Last push ${Math.round(daysSincePush)} days ago, no recent activity`,
	};
};
