const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const crypto = require('crypto');

const execPromise = util.promisify(exec);
const databasePath = path.join(__dirname, '../../database/username.json');
let lastHash = '';

/**
 * Jalankan command shell
 */
async function executeCommand(command) {
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr && !stderr.includes('nothing to commit')) console.error(stderr);
    return stdout.trim();
  } catch (error) {
    console.error(`❌ Error executing command: ${command}`);
    console.error(error.message);
    return null;
  }
}

/**
 * Generate hash unik dari file untuk mendeteksi perubahan
 */
function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const fileContent = fs.readFileSync(filePath);
  return crypto.createHash('sha1').update(fileContent).digest('hex');
}

/**
 * Backup via local git commit & push
 */
async function localGitCommit() {
  try {
    await executeCommand('git config user.name "DuckBot"');
    await executeCommand('git config user.email "bot@duckbot.com"');

    if (process.env.GITHUB_USERNAME && process.env.GITHUB_TOKEN) {
      await executeCommand(
        `git remote set-url origin https://${process.env.GITHUB_USERNAME}:${process.env.GITHUB_TOKEN}@github.com/CL4Y0101/DuckBot.git`
      );
    }

    await executeCommand('git add src/database/username.json');
    await executeCommand(
      'git commit -m "Auto-backup: update username.json" || echo "⚠️ No changes to commit"'
    );

    const pushResult = await executeCommand('git push origin main');
    if (pushResult) console.log('✅ Local git auto commit & push success!');
  } catch (error) {
    console.error('❌ Local git commit failed:', error.message);
  }
}

/**
 * Backup via GitHub API (fallback)
 */
async function apiBackup() {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    console.log('⚠️ No GITHUB_TOKEN provided. Skipping API backup.');
    return;
  }

  try {
    const { Octokit } = await import('@octokit/rest');
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
      branch,
    });

  } catch (error) {
    console.error('❌ Error during GitHub API backup:', error.message);
  }
}

/**
 * Fungsi utama backup database
 */
async function backupDatabase() {

  if (!fs.existsSync(databasePath)) {
    return;
  }

  const newHash = getFileHash(databasePath);
  if (newHash === lastHash) {
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
