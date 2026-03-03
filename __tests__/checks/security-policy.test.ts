import { describe, expect, it } from "vitest";
import { securityPolicy } from "../../src/checks/security-policy";
import { makeRepoData } from "../helpers";

describe("securityPolicy", () => {
	it("returns 0 when no policy", () => {
		const result = securityPolicy(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 3 for basic policy", () => {
		const result = securityPolicy(
			makeRepoData({ isSecurityPolicyEnabled: true, securityPolicyContent: "Report bugs" }),
		);
		expect(result.score).toBe(3);
	});

	it("scores higher with links and vuln terms", () => {
		const result = securityPolicy(
			makeRepoData({
				isSecurityPolicyEnabled: true,
				securityPolicyContent:
					"Report vulnerability at https://example.com/security. CVE tracking.",
			}),
		);
		expect(result.score).toBeGreaterThan(5);
	});
});
