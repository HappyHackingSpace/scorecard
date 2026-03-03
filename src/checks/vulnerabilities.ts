import type { CheckResult, RepoData } from "../types";

const SEVERITY_WEIGHTS: Record<string, number> = {
	critical: 4,
	high: 3,
	medium: 2,
	low: 1,
};

export const vulnerabilities = (data: RepoData): CheckResult => {
	if (!data.hasVulnerabilityAlertsEnabled) {
		return { score: -1, reason: "Vulnerability alerts not enabled" };
	}

	const openAlerts = data.vulnerabilityAlerts.filter(
		(a) => a.state === "open" || a.state === "OPEN",
	);

	if (openAlerts.length === 0) {
		return { score: 10, reason: "No open vulnerability alerts" };
	}

	const weightedSum = openAlerts.reduce((sum, alert) => {
		const weight = SEVERITY_WEIGHTS[alert.severity.toLowerCase()] ?? 1;
		return sum + weight;
	}, 0);

	const score = Math.max(0, 10 - weightedSum);

	return {
		score,
		reason: `${openAlerts.length} open vulnerability alert(s)`,
		details: openAlerts.map((a) => `${a.severity}: ${a.state}`),
	};
};
