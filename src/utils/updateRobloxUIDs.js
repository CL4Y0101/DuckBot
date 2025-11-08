const fs = require('fs');
const path = require('path');
const robloxAPI = require('./robloxAPI');

const databasePath = path.join(__dirname, '../database/username.json');

async function updateRobloxUIDs() {
    try {
        let data = [];
        if (fs.existsSync(databasePath)) {
            const fileContent = fs.readFileSync(databasePath, 'utf8');
            if (fileContent.trim()) {
                data = JSON.parse(fileContent);
            }
        }

        let updated = false;

        for (const user of data) {
            if (user.roblox_username && !user.roblox_uid) {
                console.log(`🔍 Fetching Roblox UID for ${user.roblox_username}...`);

                const robloxUid = await robloxAPI.getUserIdByUsername(user.roblox_username);
                if (robloxUid) {
                    user.roblox_uid = robloxUid;
                    updated = true;
                    console.log(`✅ Updated Roblox UID for ${user.roblox_username}: ${robloxUid}`);
                } else {
                    console.log(`❌ Could not find Roblox UID for ${user.roblox_username}`);
                }

                await robloxAPI.delay(1000);
            }

            if (user.roblox_uid && (!user.roblox_nickname || user.roblox_nickname === '')) {
                console.log(`🔍 Fetching nickname for ${user.roblox_username}...`);
                const profile = await robloxAPI.getUserProfile(user.roblox_uid);
                if (profile && profile.displayName) {
                    user.roblox_nickname = profile.displayName;
                    updated = true;
                    console.log(`✅ Updated nickname for ${user.roblox_username}: ${profile.displayName}`);
                } else {
                    console.log(`❌ Failed to fetch nickname for ${user.roblox_username}`);
                }

                await robloxAPI.delay(1000);
            }
        }

        if (updated) {
            fs.writeFileSync(databasePath, JSON.stringify(data, null, 2));
            console.log('💾 Database updated with new Roblox UIDs');
        } else {
            console.log('ℹ️ No updates needed');
        }

    } catch (error) {
        console.error('❌ Error updating Roblox UIDs:', error);
    }
}

module.exports = {
    updateRobloxUIDs
};