import type { CheckResult, RepoData } from "../types";

const BOT_SUFFIXES = ["[bot]", "-bot", "_bot"];

const isBot = (login: string): boolean => {
	const lower = login.toLowerCase();
	return BOT_SUFFIXES.some((s) => lower.endsWith(s)) || lower === "dependabot" || lower === "renovate";
};

// OSSF detects review platforms from commit messages and PR labels
const GERRIT_PATTERN = /Reviewed-on:.*\nReviewed-by:/s;
const PHABRICATOR_PATTERN = /Differential Revision:\s*.*D\d+/;
const PIPER_PATTERN = /PiperOrigin-RevId:\s*\d+/;
const PROW_LABELS = ["lgtm", "approved"];

const isExternallyReviewed = (
	message: string,
	labels: string[],
): boolean => {
	// Prow: PR has lgtm and approved labels
	const lowerLabels = labels.map((l) => l.toLowerCase());
	if (PROW_LABELS.every((pl) => lowerLabels.includes(pl))) {
		return true;
	}
	// Gerrit, Phabricator, Piper: detected from commit message
	return GERRIT_PATTERN.test(message) || PHABRICATOR_PATTERN.test(message) || PIPER_PATTERN.test(message);
};

export const codeReview = (data: RepoData): CheckResult => {
	if (data.recentCommits.length === 0) {
		return { score: -1, reason: "No recent commits to evaluate" };
	}

	const details: string[] = [];
	let total = 0;
	let approved = 0;

	for (const commit of data.recentCommits) {
		const botAuthored = isBot(commit.author.login ?? "");
		const pr = commit.associatedPullRequest;
		const hasGitHubReview = pr != null && pr.merged && pr.reviews >= 1;
		const hasExternalReview = isExternallyReviewed(
			commit.message,
			pr?.labels ?? [],
		);
		const isApproved = hasGitHubReview || hasExternalReview;

		// OSSF logic: skip approved bot changesets entirely,
		// but count unapproved bot changesets against the total
		if (botAuthored && isApproved) {
			continue;
		}

		total++;

		if (isApproved) {
			approved++;
		} else if (!pr || !pr.merged) {
			details.push(`Direct/unmerged commit: ${commit.message.slice(0, 50)}`);
		} else {
			details.push(`PR merged without review: ${commit.message.slice(0, 50)}`);
		}
	}

	if (total === 0) {
		return { score: -1, reason: "All recent commits are from bots" };
	}

	// OSSF uses Go integer division: min(10 * approved / total, 10)
	const score = Math.min(Math.floor((10 * approved) / total), 10);

	return {
		score,
		reason:
			score >= 7
				? "Most changes are reviewed"
				: `${approved}/${total} changesets approved`,
		details: details.slice(0, 10),
	};
};
