import type { CheckResult, RepoData } from "../types";

export const dependencyUpdateTool = (data: RepoData): CheckResult => {
	const tools: string[] = [];

	if (data.hasDependabot) tools.push("Dependabot");
	if (data.hasRenovate) tools.push("Renovate");

	// Check for Scala Steward config files (OSSF also checks for this)
	const scalastewardPaths = [
		".scala-steward.conf",
		".github/.scala-steward.conf",
		".github/scala-steward.conf",
		".config/.scala-steward.conf",
		".config/scala-steward.conf",
	];
	if (data.treeFiles.some((f) => scalastewardPaths.includes(f))) {
		tools.push("Scala Steward");
	}

	if (tools.length > 0) {
		return { score: 10, reason: `Dependency update tool found: ${tools.join(", ")}` };
	}

	return { score: 0, reason: "No dependency update tool detected" };
};
