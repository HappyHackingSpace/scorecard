import { describe, expect, it } from "vitest";
import { pinnedDependencies } from "../../src/checks/pinned-dependencies";
import { makeRepoData } from "../helpers";

describe("pinnedDependencies", () => {
	it("returns -1 when no dependencies", () => {
		const result = pinnedDependencies(makeRepoData());
		expect(result.score).toBe(-1);
	});

	it("returns 10 when all pinned to SHA", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: "uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 0 when all use tags (none pinned)", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: [
							"uses: actions/checkout@v4",
							"uses: actions/setup-node@v4",
						].join("\n"),
					},
				],
			}),
		);
		expect(result.score).toBe(0);
	});

	it("scores proportionally for mixed pinning (same type)", () => {
		// Both GitHub-owned → weight 10 each (only one type exists)
		// 1 pinned, 1 unpinned → floor(10*10/20) = 5
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: [
							"uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29",
							"uses: actions/setup-node@v4",
						].join("\n"),
					},
				],
			}),
		);
		expect(result.score).toBe(5);
	});

	it("uses OSSF weights when both GH-owned and third-party exist", () => {
		// GH-owned (weight 2): pinned, third-party (weight 8): unpinned
		// weighted: floor(10 * 2 / (2+8)) = floor(20/10) = 2
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: [
							"uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29",
							"uses: some-org/some-action@v1",
						].join("\n"),
					},
				],
			}),
		);
		expect(result.score).toBe(2);
	});

	it("catches @main and @master as unpinned", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: "uses: some/action@main",
					},
				],
			}),
		);
		expect(result.score).toBe(0);
	});

	it("treats local actions (./) as pinned and excluded", () => {
		// Local action not counted, only third-party counted
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: [
							"uses: ./.github/actions/my-action",
							"uses: some-org/some-action@abc123def456abc123def456abc123def456abc1",
						].join("\n"),
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("checks Dockerfiles for unpinned base images", () => {
		const result = pinnedDependencies(
			makeRepoData({
				dockerfiles: [
					{
						path: "Dockerfile",
						content: "FROM golang:1.21\nRUN go build",
					},
				],
			}),
		);
		expect(result.score).toBe(0);
	});

	it("returns 10 for pinned Docker images", () => {
		const result = pinnedDependencies(
			makeRepoData({
				dockerfiles: [
					{
						path: "Dockerfile",
						content:
							"FROM golang@sha256:a5ac7e51b41094c92402da3b24376905380afc29a5ac7e51b41094c92402da3b",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("skips FROM scratch", () => {
		const result = pinnedDependencies(
			makeRepoData({
				dockerfiles: [
					{
						path: "Dockerfile",
						content: "FROM scratch\nCOPY app /app",
					},
				],
			}),
		);
		expect(result.score).toBe(-1);
	});

	it("skips vendor/ and third_party/ Dockerfiles", () => {
		const result = pinnedDependencies(
			makeRepoData({
				dockerfiles: [
					{
						path: "vendor/some/Dockerfile",
						content: "FROM golang:1.21",
					},
					{
						path: "third_party/Dockerfile",
						content: "FROM ubuntu:latest",
					},
				],
			}),
		);
		expect(result.score).toBe(-1);
	});

	it("detects unpinned npm install in run blocks", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: [
							"jobs:",
							"  build:",
							"    steps:",
							"      - run: |",
							"          npm install",
						].join("\n"),
					},
				],
			}),
		);
		expect(result.score).toBe(0);
	});

	it("detects unpinned pip install in run blocks", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: [
							"jobs:",
							"  build:",
							"    steps:",
							"      - run: |",
							"          pip install requests",
						].join("\n"),
					},
				],
			}),
		);
		expect(result.score).toBe(0);
	});

	it("detects insecure curl pipe to bash in run blocks", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: [
							"jobs:",
							"  build:",
							"    steps:",
							"      - run: |",
							"          curl -sSL https://example.com/install.sh | bash",
						].join("\n"),
					},
				],
			}),
		);
		expect(result.score).toBe(0);
	});

	it("accepts 40+ char hex SHA (uppercase ok)", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content:
							"uses: actions/checkout@A5AC7E51B41094C92402DA3B24376905380AFC29A5AC7E51",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("detects unpinned go install in run blocks", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: [
							"jobs:",
							"  build:",
							"    steps:",
							"      - run: go install golang.org/x/tools/cmd/goimports@latest",
						].join("\n"),
					},
				],
			}),
		);
		// go install with @latest is not pinned to semver or SHA
		expect(result.score).toBeLessThan(10);
	});

	it("treats go install @vX.Y.Z as pinned", () => {
		const result = pinnedDependencies(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/ci.yml",
						content: [
							"jobs:",
							"  build:",
							"    steps:",
							"      - run: go install golang.org/x/tools/cmd/goimports@v0.1.12",
						].join("\n"),
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});
});
