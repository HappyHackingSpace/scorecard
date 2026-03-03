import type { CheckResult, RepoData } from "../types";

const LEVEL_SCORES: Record<string, number> = {
	gold: 10,
	silver: 7,
	passing: 5,
	in_progress: 2,
};

export const ciiBestPractices = (data: RepoData): CheckResult => {
	if (!data.ciiBadgeLevel) {
		return { score: 0, reason: "No CII Best Practices badge found" };
	}

	const level = data.ciiBadgeLevel.toLowerCase();
	const score = LEVEL_SCORES[level] ?? 0;

	return {
		score,
		reason: `CII Best Practices badge: ${data.ciiBadgeLevel}`,
	};
};
