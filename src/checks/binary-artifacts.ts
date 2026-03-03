import type { CheckResult, RepoData } from "../types";

const BINARY_EXTENSIONS = new Set([
	".exe",
	".dll",
	".so",
	".dylib",
	".a",
	".lib",
	".o",
	".obj",
	".class",
	".jar",
	".war",
	".ear",
	".pyc",
	".pyo",
	".wasm",
	".bin",
]);

export const binaryArtifacts = (data: RepoData): CheckResult => {
	const binaries = data.treeFiles.filter((f) => {
		const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
		return BINARY_EXTENSIONS.has(ext);
	});

	if (binaries.length === 0) {
		return { score: 10, reason: "No binary artifacts found" };
	}

	return {
		score: Math.max(0, 10 - binaries.length),
		reason: `${binaries.length} binary artifact(s) found`,
		details: binaries.slice(0, 10),
	};
};
