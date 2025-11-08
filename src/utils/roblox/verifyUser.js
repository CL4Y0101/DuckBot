const fs = require('fs');
const path = require('path');
const robloxAPI = require('./robloxAPI');
const databasePath = path.join(__dirname, '../database/username.json');

async function verifyUser(userid) {
    try {
        let data = fs.existsSync(databasePath)
            ? JSON.parse(fs.readFileSync(databasePath, 'utf8') || '[]')
            : [];

        const user = data.find(u => u.userid === userid);
        if (!user) return console.log(`❌ User ${userid} not found in database`), false;

        if (user.verified) return true;

        if (user.roblox_uid) {
            const profile = await robloxAPI.getUserProfile(user.roblox_uid);
            if (profile && profile.displayName) {
                user.roblox_nickname = profile.displayName;
            }
        }

        if (!user.roblox_nickname) return false;

        const nickname = user.roblox_nickname;
        const expectedPatterns = [
            `DV_${nickname}`,
            `DVx${nickname}`,
            `DV${nickname}`,
            `${nickname}_DV`,
            `${nickname}xDV`,
            `${nickname}DV`
        ];

        const isVerified = expectedPatterns.some(
            pattern => nickname.toLowerCase() === pattern.toLowerCase()
        );

        user.verified = isVerified;
        fs.writeFileSync(databasePath, JSON.stringify(data, null, 2));

        console.log(
            isVerified
                ? `✅ ${user.username} verified with nickname: ${nickname}`
                : `❌ ${user.username} not verified (nickname: ${nickname})`
        );

        return isVerified;
    } catch (err) {
        console.error('❌ Error verifying user:', err);
        return false;
    }
}

async function updateVerifications() {
    try {
        let data = fs.existsSync(databasePath)
            ? JSON.parse(fs.readFileSync(databasePath, 'utf8') || '[]')
            : [];

        let updated = false;

        for (const user of data) {
            if (!user.roblox_uid) continue;

            const profile = await robloxAPI.getUserProfile(user.roblox_uid);
            if (!profile) continue;

            const nickname = profile.displayName;
            const patterns = [
                `DV_${nickname}`,
                `DVx${nickname}`,
                `DV${nickname}`,
                `${nickname}_DV`,
                `${nickname}xDV`,
                `${nickname}DV`
            ];

            const isVerified = patterns.some(
                pattern => nickname.toLowerCase() === pattern.toLowerCase()
            );

            if (user.verified !== isVerified) {
                user.verified = isVerified;
                updated = true;
                console.log(
                    isVerified
                        ? `✅ Auto-verified ${user.username} (${nickname})`
                        : `❌ Auto-unverified ${user.username} (${nickname})`
                );
            }

            await robloxAPI.delay(1000);
        }

        if (updated) {
            fs.writeFileSync(databasePath, JSON.stringify(data, null, 2));
            console.log('💾 Database updated with new verifications');
        } else {
            console.log('ℹ️ No verification changes');
        }
    } catch (err) {
        console.error('❌ Error updating verifications:', err);
    }
}

module.exports = { verifyUser, updateVerifications };
