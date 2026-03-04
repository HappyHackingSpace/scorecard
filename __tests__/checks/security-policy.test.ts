import { describe, expect, it } from "vitest";
import { securityPolicy } from "../../src/checks/security-policy";
import { makeRepoData } from "../helpers";

describe("securityPolicy", () => {
	it("returns 0 when no policy", () => {
		const result = securityPolicy(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 0 for policy file with no meaningful content", () => {
		const result = securityPolicy(
			makeRepoData({ isSecurityPolicyEnabled: true, securityPolicyContent: "TODO" }),
		);
		expect(result.score).toBe(0);
	});

	it("returns 3 for policy with substantive text only", () => {
		const result = securityPolicy(
			makeRepoData({
				isSecurityPolicyEnabled: true,
				securityPolicyContent:
					"We take security seriously. Please report any bugs you find through our process.",
			}),
		);
		expect(result.score).toBe(3);
	});

	it("returns 1 for policy with disclosure term only", () => {
		const result = securityPolicy(
			makeRepoData({
				isSecurityPolicyEnabled: true,
				securityPolicyContent: "vulnerability report",
			}),
		);
		expect(result.score).toBe(1);
	});

	it("returns 10 for full policy with disclosure + text + links", () => {
		const result = securityPolicy(
			makeRepoData({
				isSecurityPolicyEnabled: true,
				securityPolicyContent:
					"Report a vulnerability at https://example.com/security. We follow responsible disclosure and track CVE identifiers.",
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 6 for policy with only links", () => {
		const result = securityPolicy(
			makeRepoData({
				isSecurityPolicyEnabled: true,
				securityPolicyContent: "See https://example.com",
			}),
		);
		expect(result.score).toBe(6);
	});

	it("returns 10 for policy with email + text + disclosure (like nuclei)", () => {
		const result = securityPolicy(
			makeRepoData({
				isSecurityPolicyEnabled: true,
				securityPolicyContent:
					"If you discover a potential security vulnerability in any of the repositories, please report it via email at security@projectdiscovery.io.",
			}),
		);
		expect(result.score).toBe(10); // 1 (disclosure) + 3 (text) + 6 (email)
	});

	it("returns 9 for policy with text + links but no disclosure terms", () => {
		const result = securityPolicy(
			makeRepoData({
				isSecurityPolicyEnabled: true,
				securityPolicyContent:
					"For security concerns, please contact us at https://example.com/contact for assistance.",
			}),
		);
		expect(result.score).toBe(9); // 3 (text) + 6 (links)
	});
});
