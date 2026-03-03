import { describe, expect, it } from "vitest";
import { graphql, restGet, restGetRaw } from "../src/github";

const mockFetch = (status: number, body: unknown, headers?: Record<string, string>) =>
	(async () =>
		({
			ok: status >= 200 && status < 300,
			status,
			statusText: status === 200 ? "OK" : "Error",
			json: async () => body,
			text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
			headers: new Headers(headers),
		}) as Response) as typeof globalThis.fetch;

const opts = (fetchFn: typeof globalThis.fetch) => ({
	token: "test-token",
	fetch: fetchFn,
});

describe("graphql", () => {
	it("returns data on success", async () => {
		const fetch = mockFetch(200, { data: { repository: { name: "test" } } });
		const result = await graphql<{ repository: { name: string } }>(
			opts(fetch),
			"query {}",
			{},
		);
		expect(result.repository.name).toBe("test");
	});

	it("throws on HTTP error", async () => {
		const fetch = mockFetch(500, {});
		await expect(graphql(opts(fetch), "query {}", {})).rejects.toThrow("GraphQL request failed");
	});

	it("throws on GraphQL errors", async () => {
		const fetch = mockFetch(200, { errors: [{ message: "Bad query" }] });
		await expect(graphql(opts(fetch), "query {}", {})).rejects.toThrow("Bad query");
	});

	it("throws on missing data", async () => {
		const fetch = mockFetch(200, {});
		await expect(graphql(opts(fetch), "query {}", {})).rejects.toThrow("missing data");
	});
});

describe("restGet", () => {
	it("returns parsed JSON on success", async () => {
		const fetch = mockFetch(200, { id: 1 });
		const result = await restGet<{ id: number }>(opts(fetch), "/repos/o/r");
		expect(result).toEqual({ id: 1 });
	});

	it("returns null on 404", async () => {
		const fetch = mockFetch(404, {});
		const result = await restGet(opts(fetch), "/repos/o/r");
		expect(result).toBeNull();
	});

	it("returns null on 403", async () => {
		const fetch = mockFetch(403, {});
		const result = await restGet(opts(fetch), "/repos/o/r");
		expect(result).toBeNull();
	});

	it("throws on other errors", async () => {
		const fetch = mockFetch(500, {});
		await expect(restGet(opts(fetch), "/repos/o/r")).rejects.toThrow("REST request failed");
	});
});

describe("restGetRaw", () => {
	it("returns raw text on success", async () => {
		const fetch = mockFetch(200, "file content");
		const result = await restGetRaw(opts(fetch), "/repos/o/r/contents/f");
		expect(result).toBe("file content");
	});

	it("returns null on 404", async () => {
		const fetch = mockFetch(404, "");
		const result = await restGetRaw(opts(fetch), "/repos/o/r/contents/f");
		expect(result).toBeNull();
	});
});
