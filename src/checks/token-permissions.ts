import type { CheckResult, RepoData } from "../types";

const TOP_LEVEL_READONLY = /^permissions:\s*read-all/m;
const TOP_LEVEL_PERMS = /^permissions:/m;
const CONTENTS_WRITE = /contents:\s*write/;
const PACKAGES_WRITE = /packages:\s*write/;

export const tokenPermissions = (data: RepoData): CheckResult => {
	if (data.workflowFiles.length === 0) {
		return { score: -1, reason: "No workflow files found" };
	}

	let score = 10;
	const details: string[] = [];

	for (const wf of data.workflowFiles) {
		if (TOP_LEVEL_READONLY.test(wf.content)) {
			details.push(`${wf.path}: top-level read-only permissions`);
			continue;
		}

		if (!TOP_LEVEL_PERMS.test(wf.content)) {
			score = Math.min(score, 5);
			details.push(`${wf.path}: no top-level permissions block`);
		}

		if (CONTENTS_WRITE.test(wf.content)) {
			score = Math.min(score, 7);
			details.push(`${wf.path}: contents:write detected`);
		}

		if (PACKAGES_WRITE.test(wf.content)) {
			score = Math.min(score, 7);
			details.push(`${wf.path}: packages:write detected`);
		}
	}

	return {
		score,
		reason: score === 10 ? "Token permissions follow least privilege" : "Broad token permissions",
		details,
	};
};
