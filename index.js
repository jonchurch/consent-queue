const fs = require('fs')
const path = require('path')
const express = require('express');
const { marked } = require('marked');

const { GITHUB_TOKEN, PORT } = require('./config')
const { getAllReposForOrg, getAllOpenPRs, getPRDetails } = require('./lib/github')
const { Lock, hoursOpen } = require('./utils')

const app = express();

if (!GITHUB_TOKEN) {
  console.error('Please set GITHUB_TOKEN in environment variables.');
  process.exit(1);
}

const HTML_FILE_PATH = path.join(__dirname, 'output.html');
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
let lastGeneratedTime = 0;

const generationLock = new Lock()

const ORGS = ['expressjs', 'pillarjs', 'jshttp'];

marked.setOptions({
  gfm: true,
  breaks: true
});

async function getPrs(orgs) {
  const allPRs = [];

  for (const org of orgs) {
    const repos = await getAllReposForOrg(org);
    console.log(`got all repos for ${org}, count: ${repos.length}`)
    for (const repo of repos) {
      const prs = await getAllOpenPRs(org, repo.name);
      console.log(`got all prs for ${repo.name}, count: ${prs.length}`)
      for (const pr of prs) {

        const { data: fullPR } = await getPRDetails(org, repo, pr)
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

  return allPRs

}

async function serveIfValid(_req, res, next) {
  const now = Date.now();

  // Check if the file exists and is within the cache duration
  if (fs.existsSync(HTML_FILE_PATH) && now - lastGeneratedTime < CACHE_DURATION) {
    console.log('Serving cached HTML');
    return res.sendFile(HTML_FILE_PATH);
  }

  console.log('Cached file invalid or missing, proceeding to regeneration...');
  next();
}

const generateHtml = async (orgs) => {
  const allPRs = await getPrs(orgs)
  console.log("finished fetching data")
  console.log(`found ${allPRs.length} PRs`)
  // Create a Markdown table for filtered PRs
  let mdContent = `# Clean Mergeable PRs\n\n`;
  mdContent += `| Org | Repo | PR # | Title | Hours Open | Link |\n`;
  mdContent += `| --- | --- | --- | --- | --- | --- |\n`;

  for (const item of allPRs) {
    mdContent += `| ${item.org} | ${item.repo} | ${item.number} | ${item.title} | ${item.hoursOpen} | <a href="${item.url}" target="_blank">View</a> |\n`;
  }

  // persist the md for now
  fs.writeFileSync(path.join(__dirname, 'output.md'), mdContent)

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

  fs.writeFileSync(HTML_FILE_PATH, html)
}

app.get('/', serveIfValid, async (_req, res) => {
  try {
    await generationLock.run(async () => {
      await generateHtml(ORGS)
      lastGeneratedTime = Date.now()
    })
    res.set('Cache-Control', `public, max-age=${CACHE_DURATION / 1000}`);
    res.sendFile(HTML_FILE_PATH);
    console.log('response sent')
  } catch (error) {
    console.error('Error generating PR report:', error);
    res.status(500).send('Error generating PR report');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


