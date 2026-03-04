import type { CheckResult, RepoData } from "../types";

export const vulnerabilities = (data: RepoData): CheckResult => {
	// OSSF uses OSV-Scanner (osv.dev), not GitHub Dependabot alerts
	const vulns = data.osvVulnerabilities;

	if (vulns.length === 0) {
		// If we found no vulns, check if we even had dependency data to scan
		// If Dependabot alerts are available, use as fallback
		if (data.hasVulnerabilityAlertsEnabled) {
			const openAlerts = data.vulnerabilityAlerts.filter(
				(a) => a.state === "open" || a.state === "OPEN",
			);
			if (openAlerts.length === 0) {
				return { score: 10, reason: "No known vulnerabilities found" };
			}
			// OSSF scoring: -1 per vulnerability, min 0
			const score = Math.max(0, 10 - openAlerts.length);
			return {
				score,
				reason: `${openAlerts.length} open vulnerability alert(s)`,
				details: openAlerts.map((a) => `${a.severity}: ${a.state}`),
			};
		}
		return { score: 10, reason: "No known vulnerabilities found" };
	}

	// OSSF scoring: -1 per vulnerability, min 0
	const score = Math.max(0, 10 - vulns.length);
	const details = vulns.slice(0, 10).map((v) => `${v.id} (${v.severity})`);

	return {
		score,
		reason: vulns.length === 0
			? "No known vulnerabilities found"
			: `${vulns.length} known vulnerability(ies) via OSV`,
		details,
	};
};
