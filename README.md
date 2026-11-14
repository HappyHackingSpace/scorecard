# @happyhackingspace/scorecard

Reference implementation of [OSSF Scorecard](https://github.com/ossf/scorecard) in TypeScript.

Computes all 20 OSSF Scorecard checks via the GitHub API directly, without depending on the OSSF public API (which only covers ~1M repos).

## Install

```bash
bun add @happyhackingspace/scorecard
# or
npm install @happyhackingspace/scorecard
```

## Usage

```typescript
import { computeScorecard } from "@happyhackingspace/scorecard";

const result = await computeScorecard("owner", "repo", {
  token: "ghp_...",
});
// → { score: 7.6, date: "2026-03-03", repo: "owner/repo", checks: [...] }
```

### Run specific checks

```typescript
const result = await computeScorecard("owner", "repo", {
  token: "ghp_...",
  checks: ["Maintained", "License"],
});
```

### Custom fetch

```typescript
const result = await computeScorecard("owner", "repo", {
  token: "ghp_...",
  fetch: customFetch,
});
```

## API

### `computeScorecard(owner, repo, options)`

Returns `Promise<ScorecardResult>`.

#### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `token` | `string` | Yes | GitHub personal access token |
| `checks` | `string[]` | No | Run only specific checks |
| `fetch` | `typeof fetch` | No | Custom fetch implementation |

#### Result

```typescript
interface ScorecardResult {
  date: string;
  repo: string;
  score: number;
  checks: ScorecardCheck[];
}

interface ScorecardCheck {
  name: string;
  score: number;     // 0-10, or -1 (inconclusive)
  reason: string;
  details?: string[];
}
```

## CLI

```bash
npx @happyhackingspace/scorecard <owner>/<repo> [--token <token>] [--checks Maintained,License] [--json]
```

The token falls back to the `GITHUB_TOKEN` (then `GH_TOKEN`) environment variable. Default output is an aligned table; `--json` prints the raw `ScorecardResult`. Exit codes: `0` success, `1` API/check failure, `2` usage error.

## GitHub Action

A composite action wraps the scorecard so any workflow can score a repository with a plain `GITHUB_TOKEN` — including private repos the token can read:

```yaml
permissions:
  contents: read
  pull-requests: write # only needed for comment-pr

jobs:
  scorecard:
    runs-on: ubuntu-latest
    steps:
      - uses: HappyHackingSpace/scorecard/action@main
        id: scorecard
        with:
          repo: ${{ github.repository }} # default
          comment-pr: "true"
          fail-below: "5"
      - run: echo "${{ steps.scorecard.outputs.score }}"
```

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `repo` | `${{ github.repository }}` | Repository to score (`owner/repo`) |
| `token` | `${{ github.token }}` | Token for GitHub API calls and the PR comment |
| `checks` | all 20 | Comma-separated list of checks to run |
| `comment-pr` | `"false"` | Post/update the score table as a PR comment (`pull_request` events) |
| `fail-below` | — | Fail the step when the aggregate score is below this threshold (0–10) |

### Outputs

| Output | Description |
|--------|-------------|
| `score` | Aggregate score (0–10) |
| `json` | Full `ScorecardResult` as single-line JSON |

The action always writes the per-check table to the job summary (`$GITHUB_STEP_SUMMARY`). With `comment-pr: "true"` it creates one marker-tagged comment per PR and updates it on subsequent runs. This repo scores itself weekly in [`scorecard-self.yml`](.github/workflows/scorecard-self.yml).

## Checks

| Check | Risk | Weight | Description |
|-------|------|--------|-------------|
| Maintained | High | 7.5 | Recent commit and issue activity |
| Dependency-Update-Tool | High | 7.5 | Dependabot or Renovate configured |
| Binary-Artifacts | High | 7.5 | No binary files in repository |
| Branch-Protection | High | 7.5 | Branch protection rules enabled |
| CI-Tests | Low | 2.5 | CI checks on recent commits |
| CII-Best-Practices | Low | 2.5 | CII Best Practices badge level |
| Code-Review | High | 7.5 | Changes reviewed before merge |
| Contributors | Low | 2.5 | Multi-org contributor diversity |
| Fuzzing | Medium | 5 | Fuzzing infrastructure detected |
| Packaging | Medium | 5 | Publishing workflows present |
| Pinned-Dependencies | Medium | 5 | Dependencies pinned to SHA |
| SAST | Medium | 5 | Static analysis tools configured |
| SBOM | Medium | 5 | Software bill of materials present |
| Security-Policy | Medium | 5 | SECURITY.md with disclosure info |
| Signed-Releases | High | 7.5 | Release signatures or SLSA provenance |
| Token-Permissions | High | 7.5 | Least-privilege workflow permissions |
| Vulnerabilities | High | 7.5 | Open vulnerability alert count |
| Dangerous-Workflow | Critical | 10 | No script injection or unsafe triggers |
| License | Low | 2.5 | OSI-approved license present |
| Webhooks | Critical | 10 | Webhook secrets configured |

## Scoring

Aggregate score uses the exact OSSF formula:

```
score = Σ(weight × check_score) / Σ(weight)
```

Weights: `Critical=10, High=7.5, Medium=5, Low=2.5`. Inconclusive checks (score=-1) are excluded.

## Development

```bash
bun install
bun run test
bun run build
bun run lint
bun run typecheck
```

## License

MIT
