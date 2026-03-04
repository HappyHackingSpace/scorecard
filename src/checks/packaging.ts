import type { CheckResult, RepoData } from "../types";

// OSSF recognizes specific GitHub Actions for packaging, not CLI commands
const PUBLISH_ACTION_PATTERNS = [
	"docker/build-push-action",
	"softprops/action-gh-release",
	"goreleaser/goreleaser-action",
	"pypa/gh-action-pypi-publish",
	"JS-DevTools/npm-publish",
	"actions-rs/cargo",
];

// CLI patterns that indicate actual publishing (only in run: blocks)
const PUBLISH_CLI_PATTERNS = [
	"npm publish",
	"npx changeset publish",
	"twine upload",
	"cargo publish",
	"gem push",
	"nuget push",
];

export const packaging = (data: RepoData): CheckResult => {
	const details: string[] = [];
	const matchedWorkflows: string[] = [];

	for (const wf of data.workflowFiles) {
		const lower = wf.content.toLowerCase();

		// Check for specific GitHub Actions (uses: directives)
		for (const pattern of PUBLISH_ACTION_PATTERNS) {
			if (lower.includes(pattern.toLowerCase())) {
				details.push(`Publishing action "${pattern}" found in ${wf.path}`);
				if (!matchedWorkflows.includes(wf.path)) {
					matchedWorkflows.push(wf.path);
				}
				break;
			}
		}

		// Check for CLI publish commands
		for (const pattern of PUBLISH_CLI_PATTERNS) {
			if (lower.includes(pattern.toLowerCase())) {
				details.push(`Publishing command "${pattern}" found in ${wf.path}`);
				if (!matchedWorkflows.includes(wf.path)) {
					matchedWorkflows.push(wf.path);
				}
				break;
			}
		}
	}

	if (matchedWorkflows.length === 0) {
		return { score: -1, reason: "No publishing workflow detected" };
	}

	// OSSF verifies workflow has actually run successfully via Actions API
	const hasSuccessfulRun = matchedWorkflows.some((wfPath) =>
		data.successfulWorkflowPaths.includes(wfPath),
	);

	if (!hasSuccessfulRun) {
		return { score: -1, reason: "Publishing workflow found but no successful runs detected", details };
	}

	return { score: 10, reason: "Publishing workflow detected with successful runs", details };
};
