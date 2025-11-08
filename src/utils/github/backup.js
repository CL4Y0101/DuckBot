const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');

const execPromise = util.promisify(exec);
const databasePath = path.join(__dirname, '../../database/username.json');
let lastHash = '';

async function executeCommand(command) {
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr) console.error(stderr);
    return stdout.trim();
  } catch (error) {
    console.error(`❌ Error executing command: ${command}`);
    console.error(error.message);
    return null;
  }
}

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const fileContent = fs.readFileSync(filePath);
  return crypto.createHash('sha1').update(fileContent).digest('hex');
}

async function localGitCommit() {
  console.log('📦 Local git mode detected. Attempting commit...');
  try {
    await executeCommand('git config user.name "DuckBot"');
    await executeCommand('git config user.email "bot@duckbot.com"');

    await executeCommand(
      `git remote set-url origin https://${process.env.GITHUB_USERNAME}:${process.env.GITHUB_TOKEN}@github.com/CL4Y0101/DuckBot.git`
    );

    await executeCommand('git add src/database/username.json');
    await executeCommand(
      'git commit -m "Auto backup: update username.json" || echo "No changes to commit"'
    );
    await executeCommand('git push origin main');
    console.log('✅ Local git auto commit & push success!');
  } catch (error) {
    console.error('❌ Local git commit failed:', error.message);
  }
}

async function apiBackup() {
  console.log('🌐 Fallback mode: GitHub API backup');
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.log('⚠️ No GITHUB_TOKEN provided. Skipping backup.');
    return;
  }

  try {
    const octokit = new Octokit({ auth: githubToken });
    const branch = 'main';
    const fileContent = fs.readFileSync(databasePath, 'utf8');
    let fileSha;

    try {
      const { data: fileData } = await octokit.repos.getContent({
        owner: 'CL4Y0101',
        repo: 'DuckBot',
        path: 'src/database/username.json',
        ref: branch,
      });
      fileSha = fileData.sha;
    } catch {
      fileSha = undefined;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: 'CL4Y0101',
      repo: 'DuckBot',
      path: 'src/database/username.json',
      message: 'Auto-backup: Update username.json',
      content: Buffer.from(fileContent).toString('base64'),
      sha: fileSha,
      branch: branch,
    });

    console.log('✅ GitHub API backup successful!');
  } catch (error) {
    console.error('❌ Error during GitHub API backup:', error.message);
  }
}

async function backupDatabase() {
  if (!fs.existsSync(databasePath)) {
    console.log('⚠️ Database file does not exist, skipping backup.');
    return;
  }

  const newHash = getFileHash(databasePath);
  if (newHash === lastHash) {
    console.log('🔁 No file changes detected. Skipping backup.');
    return;
  }
  lastHash = newHash;

  const isGitRepo = fs.existsSync(path.join(process.cwd(), '.git'));
  if (isGitRepo) {
    await localGitCommit();
  } else {
    await apiBackup();
  }
}

module.exports = { backupDatabase };
