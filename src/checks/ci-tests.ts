import type { CheckResult, RepoData } from "../types";

const CI_PATTERNS = [
	"github/workflows",
	"travis",
	"circleci",
	"jenkins",
	"azure-pipelines",
	"appveyor",
];

export const ciTests = (data: RepoData): CheckResult => {
	const commitsWithChecks = data.recentCommits.filter(
		(c) => c.statusCheckRollup === "SUCCESS" || c.statusCheckRollup === "PENDING",
	);

	const hasCiConfig =
		data.workflowFiles.length > 0 ||
		data.treeFiles.some((f) => CI_PATTERNS.some((p) => f.toLowerCase().includes(p)));

	if (!hasCiConfig && commitsWithChecks.length === 0) {
		return { score: 0, reason: "No CI tests detected" };
	}

	const total = data.recentCommits.length || 1;
	const ratio = commitsWithChecks.length / total;
	const score = Math.min(10, Math.round(ratio * 10));

	return {
		score,
		reason: `${commitsWithChecks.length}/${total} recent commits have CI checks`,
		details: hasCiConfig ? ["CI configuration found"] : [],
	};
};
