import { describe, expect, it } from "vitest";
import { fuzzing } from "../../src/checks/fuzzing";
import { makeRepoData } from "../helpers";

describe("fuzzing", () => {
	it("returns 0 when no fuzzing detected", () => {
		const result = fuzzing(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 10 when oss-fuzz found in workflows", () => {
		const result = fuzzing(
			makeRepoData({
				workflowFiles: [{ path: ".github/workflows/fuzz.yml", content: "uses: google/oss-fuzz" }],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 when project is registered in OSSFuzz", () => {
		const result = fuzzing(makeRepoData({ ossFuzzRegistered: true }));
		expect(result.score).toBe(10);
		expect(result.details).toContain("Project is registered in OSSFuzz");
	});

	it("returns 10 when clusterfuzzlite found in workflows", () => {
		const result = fuzzing(
			makeRepoData({
				workflowFiles: [
					{ path: ".github/workflows/ci.yml", content: "uses: clusterfuzzlite/action@v1" },
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 when .clusterfuzzlite/ directory exists", () => {
		const result = fuzzing(
			makeRepoData({ treeFiles: [".clusterfuzzlite/Dockerfile", ".clusterfuzzlite/config.yaml"] }),
		);
		expect(result.score).toBe(10);
	});

	it("returns 0 for generic fuzz substring in tree files", () => {
		const result = fuzzing(makeRepoData({ treeFiles: ["pkg/fuzz/helpers.go", "tests/fuzz_test.go"] }));
		expect(result.score).toBe(0);
	});

	it("returns 0 for generic fuzz substring in workflow content", () => {
		const result = fuzzing(
			makeRepoData({
				workflowFiles: [{ path: ".github/workflows/ci.yml", content: "run: go test -fuzz=." }],
			}),
		);
		expect(result.score).toBe(0);
	});

	it("returns 10 for Python atheris in workflow", () => {
		const result = fuzzing(
			makeRepoData({
				workflowFiles: [
					{ path: ".github/workflows/fuzz.yml", content: "import atheris\natheris.Setup()" },
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 for Rust libfuzzer_sys in workflow", () => {
		const result = fuzzing(
			makeRepoData({
				workflowFiles: [
					{ path: ".github/workflows/fuzz.yml", content: "use libfuzzer_sys::fuzz_target" },
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 for C/C++ LLVMFuzzerTestOneInput in workflow", () => {
		const result = fuzzing(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/fuzz.yml",
						content: "int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size)",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 for Java Jazzer in workflow", () => {
		const result = fuzzing(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/fuzz.yml",
						content: "com.code_intelligence.jazzer.api.FuzzedDataProvider",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});
});
