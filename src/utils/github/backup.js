const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const crypto = require('crypto');

const execPromise = util.promisify(exec);
const databaseDir = path.join(__dirname, '../../database');
const databaseFiles = ['afk.json', 'guild.json', 'invites.json', 'sessions.json', 'username.json'];
let lastHashes = {};
const backupBranch = process.env.GITHUB_BACKUP_BRANCH || 'database';

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

    await executeCommand('git fetch origin');
    await executeCommand(`git checkout -B ${backupBranch}`);
    for (const file of databaseFiles) {
      const filePath = path.join(databaseDir, file);
      if (fs.existsSync(filePath)) {
        await executeCommand(`git add src/database/${file}`);
      }
    }
    await executeCommand(
      'git commit -m "Auto-backup: update database files" || echo "⚠️ No changes to commit"'
    );

    const pushResult = await executeCommand(`git push origin ${backupBranch} --set-upstream`);
    if (pushResult) console.log(`✅ Local git auto commit & push success to branch ${backupBranch}!`);
  } catch (error) {
    console.error('❌ Local git commit failed:', error.message);
  }
}

/**
 * Pull the file from remote git branch into local copy (if different)
 */
async function localGitPull() {
  try {
    await executeCommand('git fetch origin');
    for (const file of databaseFiles) {
      const filePath = path.join(databaseDir, file);
      const remoteShow = await executeCommand(`git show origin/${backupBranch}:src/database/${file}`);
      if (remoteShow === null) continue;
      const localContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
      if (remoteShow !== localContent) {
        fs.writeFileSync(filePath, remoteShow, 'utf8');
        console.log(`✅ Pulled ${file} from origin/${backupBranch} and updated local copy.`);
        lastHashes[file] = getFileHash(filePath);
      }
    }
  } catch (error) {
    console.error('⚠️ localGitPull failed:', error.message);
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
    const branch = backupBranch;

    for (const file of databaseFiles) {
      const filePath = path.join(databaseDir, file);
      if (!fs.existsSync(filePath)) continue;
      const fileContent = fs.readFileSync(filePath, 'utf8');
      let fileSha;

      try {
        await octokit.git.getRef({ owner: 'CL4Y0101', repo: 'DuckBot', ref: `heads/${branch}` });
      } catch (err) {
        try {
          const { data: mainRef } = await octokit.git.getRef({ owner: 'CL4Y0101', repo: 'DuckBot', ref: 'heads/main' });
          await octokit.git.createRef({ owner: 'CL4Y0101', repo: 'DuckBot', ref: `refs/heads/${branch}`, sha: mainRef.object.sha });
          console.log(`ℹ️ Created branch ${branch} from main`);
        } catch (e) {
        }
      }

      try {
        const { data: fileData } = await octokit.repos.getContent({ owner: 'CL4Y0101', repo: 'DuckBot', path: `src/database/${file}`, ref: branch });
        fileSha = fileData.sha;
      } catch {
        fileSha = undefined;
      }

      await octokit.repos.createOrUpdateFileContents({
        owner: 'CL4Y0101',
        repo: 'DuckBot',
        path: `src/database/${file}`,
        message: `Auto-backup: Update ${file}`,
        content: Buffer.from(fileContent).toString('base64'),
        sha: fileSha,
        branch,
      });
    }

  } catch (error) {
    console.error('❌ Error during GitHub API backup:', error.message);
  }
}

/**
 * Remove duplicates based on userid, keeping the last occurrence
 */
function removeDuplicates(data) {
  return Array.from(
    data.reduce((map, item) => {
      map.set(item.userid, item);
      return map;
    }, new Map()).values()
  );
}

/**
 * Fungsi utama backup database
 */
async function backupDatabase() {
  let hasChanges = false;

  for (const file of databaseFiles) {
    const filePath = path.join(databaseDir, file);
    if (!fs.existsSync(filePath)) continue;

    if (file === 'username.json') {
      let data = [];
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        if (fileContent.trim()) {
          data = JSON.parse(fileContent);
        }
      } catch (error) {
        console.error(`Error reading ${file} for deduplication:`, error);
        continue;
      }

      const uniqueData = removeDuplicates(data);
      if (uniqueData.length !== data.length) {
        fs.writeFileSync(filePath, JSON.stringify(uniqueData, null, 2));
        console.log(`✅ Removed ${data.length - uniqueData.length} duplicate entries from ${file}`);
      }
    }

    const newHash = getFileHash(filePath);
    if (newHash !== lastHashes[file]) {
      lastHashes[file] = newHash;
      hasChanges = true;
    }
  }

  if (!hasChanges) return;

  const isGitRepo = fs.existsSync(path.join(process.cwd(), '.git'));

  if (isGitRepo) {
    await localGitCommit();
  } else {
    await apiBackup();
  }
}

/**
 * Restore database from remote branch (git or API)
 */
async function restoreDatabase() {
  const isGitRepo = fs.existsSync(path.join(process.cwd(), '.git'));
  if (isGitRepo) {
    await localGitPull();
  } else {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) return;
    try {
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: githubToken });
      for (const file of databaseFiles) {
        const filePath = path.join(databaseDir, file);
        const { data: fileData } = await octokit.repos.getContent({ owner: 'CL4Y0101', repo: 'DuckBot', path: `src/database/${file}`, ref: backupBranch });
        const remoteContent = Buffer.from(fileData.content, fileData.encoding).toString('utf8');
        const localContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
        if (remoteContent !== localContent) {
          fs.writeFileSync(filePath, remoteContent, 'utf8');
          console.log(`✅ Restored ${file} from ${backupBranch} via API`);
          lastHashes[file] = getFileHash(filePath);
        }
      }
    } catch (error) {
      console.error('⚠️ api restore failed:', error.message);
    }
  }
}

(async () => {
  try {
    await restoreDatabase();
  } catch (e) {
  }
})();

module.exports = { backupDatabase, restoreDatabase };
