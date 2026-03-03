import type { CheckResult, RepoData } from "../types";

const PUBLISH_PATTERNS = [
	"npm publish",
	"npx changeset publish",
	"pypi",
	"twine upload",
	"cargo publish",
	"gem push",
	"nuget push",
	"actions/upload-artifact",
	"docker push",
	"docker/build-push-action",
	"softprops/action-gh-release",
	"goreleaser",
	"maven-publish",
	"gradle-publish",
	"actions/setup-java",
];

export const packaging = (data: RepoData): CheckResult => {
	const details: string[] = [];

	for (const wf of data.workflowFiles) {
		const lower = wf.content.toLowerCase();
		for (const pattern of PUBLISH_PATTERNS) {
			if (lower.includes(pattern.toLowerCase())) {
				details.push(`Publishing pattern "${pattern}" found in ${wf.path}`);
			}
		}
	}

	if (details.length > 0) {
		return { score: 10, reason: "Publishing workflow detected", details };
	}

	return { score: 0, reason: "No publishing workflow detected" };
};
