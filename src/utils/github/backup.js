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

        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
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
                        ref: branch
                    });
                    fileSha = fileData.sha;
                } catch (getError) {
                    fileSha = undefined;
                }

                try {
                    await octokit.repos.createOrUpdateFileContents({
                        owner: 'CL4Y0101',
                        repo: 'DuckBot',
                        path: 'src/database/username.json',
                        message: 'Auto-backup: Update username database',
                        content: Buffer.from(fileContent).toString('base64'),
                        sha: fileSha,
                        branch: branch
                    });

                    console.log('Database backup successful via GitHub API');
                    resolve();
                } catch (apiError) {
                    console.error('Error backing up via GitHub API:', apiError);
                    reject(apiError);
                }
            } catch (tokenError) {
                console.error('Error with GitHub token:', tokenError);
                reject(tokenError);
            }
        } else {
            console.log('No GitHub token provided, skipping backup.');
            resolve();
        }
    });

}

module.exports = { backupDatabase };
