import type { CheckResult, RepoData } from "../types";

const MIN_CONTRIBUTIONS = 5;
const TARGET_ORGS = 3;

const normalizeCompany = (company: string): string =>
	company
		.toLowerCase()
		.replace(/^@/, "")
		.replace(/,.*$/, "")
		.replace(/\s+(inc\.?|llc|ltd\.?|corp\.?|gmbh|co\.?)$/i, "")
		.trim();

export const contributors = (data: RepoData): CheckResult => {
	// OSSF uses REST API contributor data with all orgs + company field
	const affiliations = new Set<string>();
	const details: string[] = [];

	for (const contributor of data.contributors) {
		if (contributor.contributions < MIN_CONTRIBUTIONS) continue;

		for (const org of contributor.organizations) {
			affiliations.add(org.toLowerCase());
		}
		if (contributor.company) {
			const normalized = normalizeCompany(contributor.company);
			if (normalized) {
				affiliations.add(normalized);
			}
		}
	}

	for (const aff of affiliations) {
		details.push(`Organization/company: ${aff}`);
	}

	const score = Math.min(10, Math.floor((affiliations.size / TARGET_ORGS) * 10));

	return {
		score,
		reason: `${affiliations.size} organization(s)/companies contributing`,
		details: details.slice(0, 10),
	};
};
