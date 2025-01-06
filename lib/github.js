const { Octokit } = require('@octokit/rest');

const { GITHUB_TOKEN } = require('../config')

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function getAllReposForOrg(org) {
  return octokit.paginate(octokit.repos.listForOrg, {
    org,
    // default to fetching only public repos, to prevent leaking private repos
    type: process.env.REPO_TYPES ?? 'public',
    per_page: 100
  });
}

async function getAllOpenPRs(org, repo) {
  return octokit.paginate(octokit.pulls.list, {
    owner: org,
    repo,
    state: 'open',
    per_page: 100
  });
}

async function getPRDetails(org, repo, pr) {
  return octokit.pulls.get({
    owner: org,
    repo: repo.name,
    pull_number: pr.number
  });

}

module.exports = {
  getAllReposForOrg,
  getAllOpenPRs,
  getPRDetails
}
