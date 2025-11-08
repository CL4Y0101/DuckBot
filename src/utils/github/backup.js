const fs = require('fs');
const path = require('path');
const {
    Octokit
} = require('@octokit/rest');
require('dotenv').config();

const databasePath = path.join(__dirname, '../../database/username.json');

async function backupDatabase() {
    if (!fs.existsSync(databasePath)) {
        console.log('⚠️ Database file does not exist, skipping backup.');
        return;
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        console.log('⚠️ No GitHub token provided, skipping backup.');
        return;
    }

    try {
        const octokit = new Octokit({
            auth: githubToken
        });
        const branch = 'main';
        const fileContent = fs.readFileSync(databasePath, 'utf8');

        let fileSha;
        try {
            const {
                data: fileData
            } = await octokit.repos.getContent({
                owner: 'CL4Y0101',
                repo: 'DuckBot',
                path: 'src/database/username.json',
                ref: branch
            });
            fileSha = fileData.sha;
        } catch {
            fileSha = undefined; // File belum ada
        }

        await octokit.repos.createOrUpdateFileContents({
            owner: 'CL4Y0101',
            repo: 'DuckBot',
            path: 'src/database/username.json',
            message: `Auto-backup: Update username database (${new Date().toLocaleString()})`,
            content: Buffer.from(fileContent).toString('base64'),
            sha: fileSha,
            branch
        });

        console.log('✅ Database backup successful via GitHub API');
    } catch (error) {
        console.error('❌ Error during GitHub backup:', error.message);
    }
}

module.exports = {
    backupDatabase
};