const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const databasePath = path.join(__dirname, '../../database/username.json');

function backupDatabase() {
    return new Promise((resolve, reject) => {
        // Check if database file exists and has changes
        if (!fs.existsSync(databasePath)) {
            console.log('Database file does not exist, skipping backup.');
            return resolve();
        }

        // Check git status to see if there are changes
        exec('git status --porcelain', (error, stdout, stderr) => {
            if (error) {
                console.error('Error checking git status:', error);
                return reject(error);
            }

            const hasChanges = stdout.trim().length > 0;

            if (!hasChanges) {
                console.log('No changes detected, skipping backup.');
                return resolve();
            }

            // Add, commit, and push changes
            exec('git add src/database/username.json && git commit -m "Auto-backup: Update username database" && git push origin main', (error, stdout, stderr) => {
                if (error) {
                    console.error('Error during backup:', error);
                    return reject(error);
                }

                console.log('Database backup successful:', stdout);
                resolve();
            });
        });
    });
}

module.exports = { backupDatabase };
