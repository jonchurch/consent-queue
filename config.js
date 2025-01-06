require('dotenv').config()

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PORT = process.env.PORT ?? 3000;
const REPO_TYPES = process.env.REPO_TYPES ?? 'public'

module.exports = {
  GITHUB_TOKEN,
  PORT,
  REPO_TYPES
}
