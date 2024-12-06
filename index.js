require('dotenv').config()
const fs = require('fs')
const path = require('path')
const express = require('express');
const { Octokit } = require('@octokit/rest');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('Please set GITHUB_TOKEN in environment variables.');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const ORGS = ['expressjs'];

marked.setOptions({
  gfm: true,
  breaks: true
});

async function getAllReposForOrg(org) {
  return await octokit.paginate(octokit.repos.listForOrg, {
    org,
    type: 'all',
    per_page: 100
  });
}

async function getAllOpenPRs(org, repo) {
  return await octokit.paginate(octokit.pulls.list, {
    owner: org,
    repo,
    state: 'open',
    per_page: 100
  });
}

// Calculate hours open
function hoursOpen(sinceDate) {
  const diffMs = Date.now() - Date.parse(sinceDate);
  const hours = diffMs / 3600000;
  return hours.toFixed(2);
}

app.get('/', async (req, res) => {
  try {
    const allPRs = [];
    
    for (const org of ORGS) {
      const repos = await getAllReposForOrg(org);
      console.log('got all orgs, count:', repos.length)
      for (const repo of repos) {
        const prs = await getAllOpenPRs(org, repo.name);
        console.log('got all prs, count:', prs.length)
        for (const pr of prs) {
          const { data: fullPR } = await octokit.pulls.get({
            owner: org,
            repo: repo.name,
            pull_number: pr.number
          });

          // Only include if mergeable_state is "clean"
          if (fullPR.mergeable_state === 'clean') {
            // we aren't accounting for when a PR was marked ready for review
            // I don't think we are also accounting for a PR which was reviewed and then had new unreviewed pushes
            // which is important if you consider these PRs for merging as a slate based on mergeable state and time alone
            // (right? idk if branch rules exist to specify that latest iteration is reviewed before updating mergable_state)
            const timeOpen = hoursOpen(fullPR.created_at);
            allPRs.push({
              org,
              repo: repo.name,
              number: fullPR.number,
              title: fullPR.title,
              url: fullPR.html_url,
              mergeable_state: fullPR.mergeable_state,
              hoursOpen: timeOpen
            });
          }
        }
      }
    }
    console.log("finished fetching data")
    // Create a Markdown table for filtered PRs
    let mdContent = `# Clean Mergeable PRs\n\n`;
    mdContent += `| Org | Repo | PR # | Title | Hours Open | Link |\n`;
    mdContent += `| --- | --- | --- | --- | --- | --- |\n`;

    for (const item of allPRs) {
      mdContent += `| ${item.org} | ${item.repo} | ${item.number} | ${item.title} | ${item.hoursOpen} | [View](${item.url}) |\n`;
    }

    const htmlContent = marked.parse(mdContent);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Clean Mergeable PRs</title>
<link rel="stylesheet" href="https://unpkg.com/github-markdown-css/github-markdown.css">
<style>
body {
  background: #f6f8fa;
  padding: 20px;
}
.markdown-body {
  box-sizing: border-box;
  min-width: 200px;
  max-width: 900px;
  margin: 0 auto;
  padding: 45px;
  background: #ffffff;
  border-radius: 6px;
  font-family: Arial, sans-serif;
}
</style>
</head>
<body>
  <article class="markdown-body">
    ${htmlContent}
  </article>
</body>
</html>`;
    fs.writeFileSync(path.join(__dirname, 'output.md'), mdContent)
    res.type('html').send(html);
    console.log('response sent')
  } catch (error) {
    console.error('Error generating PR report:', error);
    res.status(500).send('Error generating PR report');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


