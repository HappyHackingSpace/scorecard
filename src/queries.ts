export const REPO_QUERY = `
query RepoData($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    isArchived
    pushedAt
    createdAt
    hasIssuesEnabled
    name
    owner {
      login
    }
    licenseInfo {
      key
      name
      url
      spdxId
    }
    isSecurityPolicyEnabled
    hasVulnerabilityAlertsEnabled
    defaultBranchRef {
      name
      target {
        ... on Commit {
          history(first: 30) {
            nodes {
              message
              committedDate
              author {
                user {
                  login
                  organization(login: $owner) {
                    login
                  }
                }
              }
              associatedPullRequests(first: 1) {
                nodes {
                  merged
                  reviews(first: 10) {
                    totalCount
                  }
                }
              }
              statusCheckRollup {
                state
              }
            }
          }
        }
      }
    }
    branchProtectionRules(first: 5) {
      nodes {
        allowsForcePushes
        allowsDeletions
        requiresApprovingReviews
        requiredApprovingReviewCount
        requiresStatusChecks
        requiresCodeOwnerReviews
        dismissesStaleReviews
        isAdminEnforced
      }
    }
    releases(first: 5, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes {
        tagName
        createdAt
        releaseAssets(first: 20) {
          nodes {
            name
            downloadUrl
          }
        }
      }
    }
    issues(states: [OPEN, CLOSED], last: 30) {
      totalCount
    }
  }
}
`;
