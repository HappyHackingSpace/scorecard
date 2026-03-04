import type { CheckResult, RepoData } from "../types";

const DISCLOSURE_TERMS = [
	"vulnerability",
	"cve",
	"security advisory",
	"responsible disclosure",
	"report a vulnerability",
	"report a security",
	"disclosure",
];

const LINK_PATTERN = /https?:\/\/[^\s)]+/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export const securityPolicy = (data: RepoData): CheckResult => {
	if (!data.isSecurityPolicyEnabled) {
		return { score: 0, reason: "No security policy found" };
	}

	let score = 0;
	const details: string[] = ["Security policy file present"];
	const content = data.securityPolicyContent?.toLowerCase() ?? "";

	// +1: has vulnerability disclosure terms
	const hasDisclosure = DISCLOSURE_TERMS.some((term) => content.includes(term));
	if (hasDisclosure) {
		score += 1;
		details.push("Contains vulnerability disclosure information");
	}

	// +3: has substantive text content (> 50 chars)
	if (content.length > 50) {
		score += 3;
		details.push("Contains substantive text content");
	}

	// +6: contains links or email addresses
	if (LINK_PATTERN.test(content) || EMAIL_PATTERN.test(content)) {
		score += 6;
		details.push("Contains links or contact information for reporting");
	}

	return {
		score: Math.min(10, score),
		reason: score > 0 ? "Security policy found" : "Security policy file present but lacks content",
		details,
	};
};
