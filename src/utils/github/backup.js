const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');

const databasePath = path.join(__dirname, '../../database/username.json');

function getFileHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function backupDatabase() {
  if (!fs.existsSync(databasePath)) {
    console.log('⚠️  Database file does not exist, skipping backup.');
    return;
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.log('⚠️  No GitHub token provided, skipping backup.');
    return;
  }

  try {
    const octokit = new Octokit({ auth: githubToken });
    const branch = 'main';
    const repoOwner = 'CL4Y0101';
    const repoName = 'DuckBot';
    const filePathInRepo = 'src/database/username.json';

    const localContent = fs.readFileSync(databasePath, 'utf8');
    const localHash = getFileHash(localContent);

    let remoteSha = null;
    let remoteHash = null;

    try {
      const { data: remoteFile } = await octokit.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: filePathInRepo,
        ref: branch,
      });

      const remoteContent = Buffer.from(remoteFile.content, 'base64').toString('utf8');
      remoteSha = remoteFile.sha;
      remoteHash = getFileHash(remoteContent);

      if (remoteHash === localHash) {
        console.log('🟡 No database changes detected — skipping backup.');
        return;
      }
    } catch (error) {
      if (error.status === 404) {
        console.log('ℹ️  No existing database found in repo — will create one.');
      } else {
        throw error;
      }
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: repoOwner,
      repo: repoName,
      path: filePathInRepo,
      message: `Auto-backup: Update username database (${new Date().toISOString()})`,
      content: Buffer.from(localContent).toString('base64'),
      sha: remoteSha || undefined,
      branch,
    });

    console.log('✅ Database backup committed successfully to GitHub.');
  } catch (error) {
    console.error('❌ Error during GitHub backup:', error.message);
  }
}

module.exports = { backupDatabase };