import type { CheckResult, RepoData } from "../types";

export const dependencyUpdateTool = (data: RepoData): CheckResult => {
	const tools: string[] = [];

	if (data.hasDependabot) tools.push("Dependabot");
	if (data.hasRenovate) tools.push("Renovate");

	if (tools.length > 0) {
		return { score: 10, reason: `Dependency update tool found: ${tools.join(", ")}` };
	}

	return { score: 0, reason: "No dependency update tool detected" };
};
