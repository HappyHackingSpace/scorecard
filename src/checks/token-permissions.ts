import type { CheckResult, RepoData } from "../types";

const TOP_LEVEL_READONLY = /^permissions:\s*read-all/m;
const TOP_LEVEL_PERMS = /^permissions:/m;
const JOB_LEVEL_PERMS = /^\s+permissions:/m;
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

		const hasTopLevel = TOP_LEVEL_PERMS.test(wf.content);
		const hasJobLevel = JOB_LEVEL_PERMS.test(wf.content);

		// OSSF: undeclared at both top and job level → score 0
		if (!hasTopLevel && !hasJobLevel) {
			score = 0;
			details.push(`${wf.path}: no permissions block declared`);
			continue;
		}

		if (!hasTopLevel) {
			score = Math.min(score, 5);
			details.push(`${wf.path}: no top-level permissions block`);
		}

		if (CONTENTS_WRITE.test(wf.content)) {
			score = Math.min(score, 0);
			details.push(`${wf.path}: contents:write detected`);
		}

		if (PACKAGES_WRITE.test(wf.content)) {
			score = Math.min(score, 0);
			details.push(`${wf.path}: packages:write detected`);
		}
	}

	return {
		score,
		reason: score === 10 ? "Token permissions follow least privilege" : "Broad token permissions",
		details,
	};
};
