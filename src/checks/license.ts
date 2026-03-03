import type { CheckResult, RepoData } from "../types";

const OSI_APPROVED = new Set([
	"mit",
	"apache-2.0",
	"gpl-2.0",
	"gpl-3.0",
	"bsd-2-clause",
	"bsd-3-clause",
	"lgpl-2.1",
	"lgpl-3.0",
	"mpl-2.0",
	"isc",
	"unlicense",
	"artistic-2.0",
	"0bsd",
	"agpl-3.0",
]);

const LICENSE_FILE_NAMES = [
	"license",
	"licence",
	"license.md",
	"license.txt",
	"copying",
	"copying.md",
];

export const license = (data: RepoData): CheckResult => {
	let score = 0;
	const details: string[] = [];

	if (data.licenseKey && data.licenseKey !== "other") {
		score = 6;
		details.push(`License detected: ${data.licenseName ?? data.licenseKey}`);
	}

	const hasTopLevelLicense = data.treeFiles.some((f) => {
		const name = f.split("/").pop()?.toLowerCase() ?? "";
		return LICENSE_FILE_NAMES.includes(name);
	});

	if (hasTopLevelLicense) {
		score += 3;
		details.push("Top-level license file found");
	}

	if (data.spdxId && OSI_APPROVED.has(data.spdxId.toLowerCase())) {
		score += 1;
		details.push("OSI-approved license");
	}

	if (score === 0) {
		return { score: 0, reason: "No license detected" };
	}

	return {
		score: Math.min(10, score),
		reason: "License found",
		details,
	};
};
