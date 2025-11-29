const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const crypto = require('crypto');

const execPromise = util.promisify(exec);
const databaseDir = path.join(__dirname, '../../database');
const databaseFiles = ['afk.json', 'guild.json', 'invites.json', 'sessions.json', 'username.json', 'venity.json', 'tempvoice.json'];
let lastHashes = {};
let lastCommitSHA = null;
const backupBranch = process.env.GITHUB_BACKUP_BRANCH || 'database';
let backupWatcher = null;
let _debounceTimer = null;
let _lastBackupTime = 0;

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
      const remotePaths = [`src/database/${file}`, `database/src/database/${file}`];
      let remoteShow = null;
      for (const rp of remotePaths) {
        remoteShow = await executeCommand(`git show origin/${backupBranch}:${rp}`);
        if (remoteShow !== null && remoteShow !== '') {
          console.log(`ℹ️ Found remote file for ${file} at ${rp}`);
          break;
        }
        remoteShow = null;
      }
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
 * Trigger an immediate backup (no dedup/hash checks) — used by watcher and manual calls.
 */
async function triggerImmediateBackup() {
  try {
    const isGitRepo = fs.existsSync(path.join(process.cwd(), '.git'));
    if (isGitRepo) {
      await localGitCommit();
    } else {
      await apiBackup();
    }
  } catch (error) {
    console.error('❌ triggerImmediateBackup failed:', error.message);
  }
}

/**
 * Start watching the database directory for changes and trigger immediate backups (debounced).
 */
function startBackupWatcher() {
  try {
    if (backupWatcher) return;
    if (!fs.existsSync(databaseDir)) return;

    backupWatcher = fs.watch(databaseDir, (eventType, filename) => {
      try {
        if (!filename) return;
        if (!databaseFiles.includes(filename)) return;

        if (_debounceTimer) clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(async () => {
          const now = Date.now();
          if (now - _lastBackupTime < 1000) return;
          await triggerImmediateBackup();
          _lastBackupTime = Date.now();
        }, 1500);
      } catch (err) {
        console.error('❌ Error in backup watcher handler:', err.message);
      }
    });

    console.log(`👀 Started watching ${databaseDir} for immediate backups`);
  } catch (error) {
    console.error('❌ Failed to start backup watcher:', error.message);
  }
}

function stopBackupWatcher() {
  try {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer);
      _debounceTimer = null;
    }
    if (backupWatcher) {
      backupWatcher.close();
      backupWatcher = null;
      console.log('⏹️ Stopped backup watcher');
    }
  } catch (error) {
    console.error('❌ Failed to stop backup watcher:', error.message);
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
        const remoteCandidates = [`src/database/${file}`, `database/src/database/${file}`];
        let remoteContent = null;
        let usedPath = null;
        for (const rp of remoteCandidates) {
          try {
            const { data: fileData } = await octokit.repos.getContent({ owner: 'CL4Y0101', repo: 'DuckBot', path: rp, ref: backupBranch });
            remoteContent = Buffer.from(fileData.content, fileData.encoding).toString('utf8');
            usedPath = rp;
            console.log(`ℹ️ Found remote file for ${file} at ${rp}`);
            break;
          } catch (e) {
          }
        }
        if (!remoteContent) continue;

        const localContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
        if (remoteContent !== localContent) {
          const localStat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
          const localMtime = localStat ? localStat.mtimeMs : 0;
          const now = Date.now();
          const GRACE_MS = 2 * 60 * 1000; // 2 minutes grace period

          if (localMtime && (now - localMtime) < GRACE_MS) {
            console.warn(`⚠️ Skipping restore of ${file} because local file was modified recently (${Math.round((now - localMtime) / 1000)}s ago)`);
            continue;
          }

          fs.writeFileSync(filePath, remoteContent, 'utf8');
          console.log(`✅ Restored ${file} from ${backupBranch} via API (source: ${usedPath})`);
          lastHashes[file] = getFileHash(filePath);
        }
      }
    } catch (error) {
      console.error('⚠️ api restore failed:', error.message);
    }
  }
}

/**
 * Check and pull remote changes (alias for restoreDatabase)
 */
async function checkAndPullRemoteChanges() {
  await restoreDatabase();
}

(async () => {
  try {
    await restoreDatabase();
  } catch (e) {
  }
})();

module.exports = { triggerImmediateBackup, restoreDatabase, checkAndPullRemoteChanges, startBackupWatcher, stopBackupWatcher };
