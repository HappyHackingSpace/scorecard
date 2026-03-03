import type { CheckResult, RepoData } from "../types";

const SIGNATURE_PATTERNS = [".sig", ".asc", ".sign", ".pem", ".intoto.jsonl", "provenance"];
const SLSA_PATTERN = /slsa|intoto|provenance/i;

export const signedReleases = (data: RepoData): CheckResult => {
	if (data.releases.length === 0) {
		return { score: -1, reason: "No releases found" };
	}

	let signedCount = 0;
	let hasSlsa = false;
	const details: string[] = [];

	for (const release of data.releases) {
		const hasSignature = release.assets.some((a) =>
			SIGNATURE_PATTERNS.some((p) => a.name.toLowerCase().includes(p)),
		);

		if (release.assets.some((a) => SLSA_PATTERN.test(a.name))) {
			hasSlsa = true;
			details.push(`SLSA provenance found in ${release.tagName}`);
		}

		if (hasSignature) {
			signedCount++;
			details.push(`Signed: ${release.tagName}`);
		}
	}

	if (hasSlsa) {
		return { score: 10, reason: "SLSA provenance detected", details };
	}

	if (signedCount === data.releases.length) {
		return { score: 8, reason: "All releases are signed", details };
	}

	const score = Math.round((signedCount / data.releases.length) * 8);
	return {
		score,
		reason: `${signedCount}/${data.releases.length} releases signed`,
		details,
	};
};
