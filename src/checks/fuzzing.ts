import type { CheckResult, RepoData } from "../types";

const FUZZING_PATTERNS = [
	"oss-fuzz",
	"clusterfuzzlite",
	"fuzz",
	"fuzzing",
	"libfuzzer",
	"afl",
	"honggfuzz",
	"go-fuzz",
	"jazzer",
	"atheris",
	"cargo-fuzz",
];

export const fuzzing = (data: RepoData): CheckResult => {
	const details: string[] = [];

	for (const wf of data.workflowFiles) {
		const lower = wf.content.toLowerCase();
		for (const pattern of FUZZING_PATTERNS) {
			if (lower.includes(pattern)) {
				details.push(`Fuzzing pattern "${pattern}" found in ${wf.path}`);
			}
		}
	}

	if (data.treeFiles.some((f) => f.toLowerCase().includes("fuzz"))) {
		details.push("Fuzz-related files found in repository");
	}

	if (details.length > 0) {
		return { score: 10, reason: "Fuzzing detected", details };
	}

	return { score: 0, reason: "No fuzzing detected" };
};
