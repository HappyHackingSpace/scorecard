import type { CheckResult, RepoData } from "../types";

const WORKFLOW_PATTERNS: { name: string; pattern: RegExp }[] = [
	{ name: "OSSFuzz", pattern: /oss-fuzz/i },
	{ name: "ClusterFuzzLite", pattern: /clusterfuzzlite/i },
	{ name: "Go built-in fuzzer", pattern: /func\s+Fuzz\w+\s*\(/ },
	{ name: "Python atheris", pattern: /import\s+atheris/i },
	{ name: "Rust libFuzzer", pattern: /libfuzzer_sys/i },
	{ name: "C/C++ libFuzzer", pattern: /LLVMFuzzerTestOneInput/i },
	{ name: "Java Jazzer", pattern: /com\.code_intelligence\.jazzer/i },
];

export const fuzzing = (data: RepoData): CheckResult => {
	const details: string[] = [];

	// Check OSSFuzz external registry
	if (data.ossFuzzRegistered) {
		details.push("Project is registered in OSSFuzz");
	}

	// Check for .clusterfuzzlite/ directory in tree
	if (data.treeFiles.some((f) => f.startsWith(".clusterfuzzlite/"))) {
		details.push("ClusterFuzzLite configuration found in repository");
	}

	// Check workflow files for specific fuzzer integrations
	for (const wf of data.workflowFiles) {
		for (const { name, pattern } of WORKFLOW_PATTERNS) {
			if (pattern.test(wf.content)) {
				details.push(`${name} detected in ${wf.path}`);
			}
		}
	}

	if (details.length > 0) {
		return { score: 10, reason: "Fuzzing detected", details };
	}

	return { score: 0, reason: "No fuzzing detected" };
};
