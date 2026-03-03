import type { CheckResult, RepoData } from "../types";

const VULN_TERMS = ["vulnerability", "cve", "security advisory", "responsible disclosure"];
const LINK_PATTERN = /https?:\/\/[^\s)]+/;

export const securityPolicy = (data: RepoData): CheckResult => {
	if (!data.isSecurityPolicyEnabled) {
		return { score: 0, reason: "No security policy found" };
	}

	let score = 3;
	const details: string[] = ["Security policy enabled"];
	const content = data.securityPolicyContent?.toLowerCase() ?? "";

	if (LINK_PATTERN.test(content)) {
		score += 3;
		details.push("Contains links for reporting");
	}

	const vulnTermCount = VULN_TERMS.filter((term) => content.includes(term)).length;
	if (vulnTermCount > 0) {
		score += Math.min(vulnTermCount, 4);
		details.push(`Contains ${vulnTermCount} vulnerability-related term(s)`);
	}

	return {
		score: Math.min(10, score),
		reason: "Security policy found",
		details,
	};
};
