const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

const databasePath = path.join(__dirname, '../../database/username.json');

function backupDatabase() {
    return new Promise(async (resolve, reject) => {
        if (!fs.existsSync(databasePath)) {
            console.log('Database file does not exist, skipping backup.');
            return resolve();
        }

        exec('git status --porcelain', async (error, stdout, stderr) => {
            if (error) {
                console.error('Error checking git status:', error);
                return reject(error);
            }

            const hasChanges = stdout.trim().length > 0;

            if (!hasChanges) {
                console.log('No changes detected, skipping backup.');
                return resolve();
            }

            const githubToken = process.env.GITHUB_TOKEN;
            if (githubToken) {
                try {
                    const octokit = new Octokit({ auth: githubToken });

                    exec('git branch --show-current', async (error, stdout, stderr) => {
                        if (error) {
                            console.error('Error getting current branch:', error);
                            return reject(error);
                        }

                        const branch = stdout.trim();
                        const fileContent = fs.readFileSync(databasePath, 'utf8');

                        exec('git rev-parse HEAD', async (error, stdout, stderr) => {
                            if (error) {
                                console.error('Error getting latest commit SHA:', error);
                                return reject(error);
                            }

                            const latestCommitSha = stdout.trim();

                            try {
                                await octokit.repos.createOrUpdateFileContents({
                                    owner: 'CL4Y0101',
                                    repo: 'DuckBot',
                                    path: 'src/database/username.json',
                                    message: 'Auto-backup: Update username database',
                                    content: Buffer.from(fileContent).toString('base64'),
                                    sha: latestCommitSha,
                                    branch: branch
                                });

                                console.log('Database backup successful via GitHub API');
                                resolve();
                            } catch (apiError) {
                                console.error('Error backing up via GitHub API:', apiError);
                                fallbackToGit(resolve, reject);
                            }
                        });
                    });
                } catch (tokenError) {
                    console.error('Error with GitHub token:', tokenError);
                    fallbackToGit(resolve, reject);
                }
            } else {
                fallbackToGit(resolve, reject);
            }
        });
    });
}

function fallbackToGit(resolve, reject) {
    exec('git add src/database/username.json && git commit -m "Auto-backup: Update username database" && git push origin main', (error, stdout, stderr) => {
        if (error) {
            console.error('Error during git backup:', error);
            return reject(error);
        }

        console.log('Database backup successful via git:', stdout);
        resolve();
    });
}

module.exports = { backupDatabase };
