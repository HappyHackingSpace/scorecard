import type { CheckResult, RepoData } from "../types";

const SAST_PATTERNS = [
	"codeql",
	"sonarcloud",
	"sonarqube",
	"semgrep",
	"snyk",
	"coverity",
	"fortify",
	"checkmarx",
	"veracode",
	"codacy",
	"lgtm",
	"github/codeql-action",
];

export const sast = (data: RepoData): CheckResult => {
	const details: string[] = [];

	for (const wf of data.workflowFiles) {
		const lower = wf.content.toLowerCase();
		for (const pattern of SAST_PATTERNS) {
			if (lower.includes(pattern)) {
				details.push(`SAST tool "${pattern}" found in ${wf.path}`);
			}
		}
	}

	const recentPRsWithChecks = data.recentCommits.filter(
		(c) => c.statusCheckRollup === "SUCCESS" && c.associatedPullRequest?.merged,
	);

	if (recentPRsWithChecks.length > 0 && details.length === 0) {
		details.push("CI checks passing on merged PRs");
	}

	if (details.length > 0) {
		return { score: 10, reason: "SAST tool detected", details };
	}

	return { score: 0, reason: "No SAST tool detected" };
};
