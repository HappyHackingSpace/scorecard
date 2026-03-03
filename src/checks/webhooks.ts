import type { CheckResult, RepoData } from "../types";

export const webhooks = (data: RepoData): CheckResult => {
	if (data.webhooks.length === 0) {
		return { score: -1, reason: "No webhooks configured" };
	}

	const activeWebhooks = data.webhooks.filter((w) => w.active);

	if (activeWebhooks.length === 0) {
		return { score: -1, reason: "No active webhooks" };
	}

	const withSecret = activeWebhooks.filter((w) => w.config.secret);
	const withoutSecret = activeWebhooks.filter((w) => !w.config.secret);

	if (withoutSecret.length === 0) {
		return { score: 10, reason: "All webhooks have secrets configured" };
	}

	const score = Math.round((withSecret.length / activeWebhooks.length) * 10);

	return {
		score,
		reason: `${withoutSecret.length} webhook(s) without secret`,
		details: withoutSecret.map((w) => `Webhook ${w.id}: no secret configured`),
	};
};
