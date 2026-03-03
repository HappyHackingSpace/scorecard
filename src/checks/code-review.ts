import type { CheckResult, RepoData } from "../types";

export const codeReview = (data: RepoData): CheckResult => {
	if (data.recentCommits.length === 0) {
		return { score: -1, reason: "No recent commits to evaluate" };
	}

	let score = 10;
	const details: string[] = [];

	for (const commit of data.recentCommits) {
		const pr = commit.associatedPullRequest;
		const isBot = commit.author.login?.includes("[bot]") || commit.author.login?.includes("bot");

		if (!pr || !pr.merged) {
			if (isBot) {
				score -= 3;
				details.push(`Unreviewed bot commit: ${commit.message.slice(0, 50)}`);
			} else {
				score -= 7;
				details.push(`Unreviewed commit: ${commit.message.slice(0, 50)}`);
			}
			continue;
		}

		if (pr.reviews === 0) {
			score -= 3;
			details.push(`PR merged without review: ${commit.message.slice(0, 50)}`);
		}
	}

	score = Math.max(0, Math.min(10, score));

	return {
		score,
		reason:
			score >= 7 ? "Most changes are reviewed" : `${details.length} unreviewed change(s) found`,
		details: details.slice(0, 10),
	};
};
