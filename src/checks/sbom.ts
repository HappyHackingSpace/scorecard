import type { CheckResult, RepoData } from "../types";

const SBOM_FILE_PATTERNS = ["sbom", "bom.json", "bom.xml", "spdx", "cyclonedx"];
const SBOM_RELEASE_PATTERNS = ["sbom", "spdx", "cyclonedx", "bom"];

export const sbom = (data: RepoData): CheckResult => {
	let score = 0;
	const details: string[] = [];

	const hasSbomFile = data.treeFiles.some((f) => {
		const lower = f.toLowerCase();
		return SBOM_FILE_PATTERNS.some((p) => lower.includes(p));
	});

	if (hasSbomFile) {
		score += 5;
		details.push("SBOM file found in repository");
	}

	const hasSbomRelease = data.releases.some((r) =>
		r.assets.some((a) => {
			const lower = a.name.toLowerCase();
			return SBOM_RELEASE_PATTERNS.some((p) => lower.includes(p));
		}),
	);

	if (hasSbomRelease) {
		score += 5;
		details.push("SBOM published as release asset");
	}

	if (score === 0) {
		return { score: 0, reason: "No SBOM found" };
	}

	return { score: Math.min(10, score), reason: "SBOM detected", details };
};
