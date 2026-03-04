import type { CheckResult, RepoData } from "../types";

// OSSF workflow detection: uses: field regex matching
// From checks/raw/sast.go: getSastUsesWorkflows
const CODEQL_PATTERN = /github\/codeql-action\/analyze/;
const OTHER_SAST_WORKFLOW_PATTERNS: { name: string; pattern: RegExp }[] = [
	{ name: "Snyk", pattern: /snyk\/actions\// },
	{ name: "Pysa", pattern: /facebook\/pysa-action/ },
	{ name: "Qodana", pattern: /JetBrains\/qodana-action/ },
	{ name: "Hadolint", pattern: /hadolint\/hadolint-action/ },
];

// Sonar detection via pom.xml (OSSF checks for <sonar.host.url>)
const SONAR_POM_PATTERN = /<sonar\.host\.url>/;

// Additional non-workflow SAST tools (instant 10 like OSSF)
const SEMGREP_PATTERN = /returntocorp\/semgrep|semgrep\/semgrep/;

export const sast = (data: RepoData): CheckResult => {
	const details: string[] = [];

	let hasCodeQL = false;
	let hasOtherSAST = false;

	for (const wf of data.workflowFiles) {
		if (CODEQL_PATTERN.test(wf.content)) {
			hasCodeQL = true;
			details.push(`CodeQL detected in ${wf.path}`);
		}
		for (const tool of OTHER_SAST_WORKFLOW_PATTERNS) {
			if (tool.pattern.test(wf.content)) {
				hasOtherSAST = true;
				details.push(`${tool.name} detected in ${wf.path}`);
			}
		}
		if (SEMGREP_PATTERN.test(wf.content)) {
			hasOtherSAST = true;
			details.push(`Semgrep detected in ${wf.path}`);
		}
	}

	// OSSF: check pom.xml for Sonar configuration
	for (const f of data.treeFiles) {
		if (f.endsWith("pom.xml") && !hasOtherSAST) {
			// We don't fetch pom.xml content currently, but if workflow files contain sonar references
			// that's detected above. For pom.xml we'd need content — skip unless we add it.
			break;
		}
	}

	// OSSF priority 1: any non-CodeQL SAST tool → instant max score (10)
	if (hasOtherSAST) {
		return { score: 10, reason: "SAST tool detected", details };
	}

	// Compute per-commit SAST coverage from actual Check Runs data
	// OSSF: only counts merged PRs, checks Check Suites for SAST app slugs
	const sastResults = data.mergedPRSASTResults;
	const total = sastResults.length;
	const analyzed = sastResults.filter((r) => r.hasSASTCheck).length;

	const sastScore = total > 0 ? Math.min(Math.floor((10 * analyzed) / total), 10) : -1;

	// OSSF priority logic from checks/evaluation/sast.go:
	// Both inconclusive: error (we return -1)
	if (sastScore === -1 && !hasCodeQL) {
		return { score: 0, reason: "No SAST tool detected" };
	}

	// Both conclusive
	if (sastScore !== -1 && hasCodeQL) {
		// All PRs have SAST check runs → max score
		if (sastScore === 10) {
			return { score: 10, reason: "SAST tool is run on all commits", details };
		}
		// CodeQL configured → weighted average
		const codeQlScore = 10; // binary: configured
		const score = Math.floor((sastScore * 3 + codeQlScore * 7) / 10);
		details.push(`${analyzed}/${total} merged PRs with SAST analysis`);
		return {
			score: Math.min(10, score),
			reason: "SAST tool detected but not run on all commits",
			details,
		};
	}

	// Only CodeQL conclusive (no merged PRs to check coverage)
	if (hasCodeQL) {
		return { score: 10, reason: "SAST tool detected: CodeQL", details };
	}

	// Only sast coverage conclusive (no CodeQL workflow found but SAST runs detected)
	if (sastScore === 10) {
		return { score: 10, reason: "SAST tool is run on all commits", details };
	}

	return {
		score: Math.max(0, sastScore),
		reason: `SAST coverage: ${analyzed}/${total} merged PRs`,
		details,
	};
};
