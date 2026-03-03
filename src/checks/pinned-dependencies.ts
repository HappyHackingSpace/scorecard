import type { CheckResult, RepoData } from "../types";

const SHA_PATTERN = /uses:\s*[\w\-./]+@([a-f0-9]{40})/g;
const TAG_PATTERN = /uses:\s*[\w\-./]+@(v?\d[\w.]*)/g;
const DOCKER_SHA_PATTERN = /FROM\s+\S+@sha256:[a-f0-9]{64}/g;
const DOCKER_TAG_PATTERN = /FROM\s+\S+:[\w.-]+/g;

export const pinnedDependencies = (data: RepoData): CheckResult => {
	let totalDeps = 0;
	let pinnedDeps = 0;
	const details: string[] = [];

	for (const wf of data.workflowFiles) {
		const shaMatches = wf.content.match(SHA_PATTERN) ?? [];
		const tagMatches = wf.content.match(TAG_PATTERN) ?? [];

		pinnedDeps += shaMatches.length;
		totalDeps += shaMatches.length + tagMatches.length;

		if (tagMatches.length > 0) {
			details.push(`${wf.path}: ${tagMatches.length} action(s) not pinned to SHA`);
		}
	}

	for (const file of data.treeFiles.filter((f) => f.toLowerCase().includes("dockerfile"))) {
		const wf = data.workflowFiles.find((w) => w.path === file);
		if (!wf) continue;
		const dockerSha = wf.content.match(DOCKER_SHA_PATTERN) ?? [];
		const dockerTag = wf.content.match(DOCKER_TAG_PATTERN) ?? [];
		pinnedDeps += dockerSha.length;
		totalDeps += dockerSha.length + dockerTag.length;
	}

	if (totalDeps === 0) {
		return { score: -1, reason: "No dependencies to evaluate" };
	}

	const score = Math.round((pinnedDeps / totalDeps) * 10);

	return {
		score,
		reason: `${pinnedDeps}/${totalDeps} dependencies pinned`,
		details: details.slice(0, 10),
	};
};
