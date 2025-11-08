const fs = require('fs');
const path = require('path');
const robloxAPI = require('./robloxAPI');
const databasePath = path.join(__dirname, '../database/username.json');

async function verifyUser(userid) {
    try {
        let data = [];
        if (fs.existsSync(databasePath)) {
            const fileContent = fs.readFileSync(databasePath, 'utf8');
            if (fileContent.trim()) {
                data = JSON.parse(fileContent);
            }
        }

        const user = data.find(u => u.userid === userid);
        if (!user) {
            console.log(`❌ User ${userid} not found in database`);
            return false;
        }

        if (user.verified) {
            console.log(`✅ User ${userid} already verified`);
            return true;
        }

        if (!user.roblox_nickname && user.roblox_uid) {
            const profile = await robloxAPI.getUserProfile(user.roblox_uid);
            if (profile) {
                user.roblox_nickname = profile.displayName;
                console.log(`📝 Fetched nickname for ${user.roblox_username}: ${user.roblox_nickname}`);
            }
        }

        if (!user.roblox_nickname) {
            console.log(`⚠️ No nickname available for user ${userid}`);
            return false;
        }

        const nickname = user.roblox_nickname;

        const patterns = [
            `DV_${nickname}`,
            `DVx${nickname}`,
            `DV${nickname}`,
            `${nickname}_DV`,
            `${nickname}xDV`,
            `${nickname}DV`
        ];

        const isVerified = patterns.some(pattern =>
            nickname.toLowerCase() === pattern.toLowerCase()
        );

        if (isVerified) {
            user.verified = true;
            fs.writeFileSync(databasePath, JSON.stringify(data, null, 2));
            console.log(`✅ User ${userid} verified with nickname: ${nickname}`);
            return true;
        } else {
            console.log(`❌ User ${userid} not verified. Nickname: ${nickname}, Expected patterns: ${patterns.join(', ')}`);
            return false;
        }

    } catch (error) {
        console.error('❌ Error verifying user:', error);
        return false;
    }
}

async function updateVerifications() {
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
            if (user.roblox_uid) {
                const profile = await robloxAPI.getUserProfile(user.roblox_uid);
                if (profile) {
                    const oldNickname = user.roblox_nickname;
                    user.roblox_nickname = profile.displayName;

                    if (oldNickname !== profile.displayName) {
                        console.log(`📝 Nickname updated for ${user.roblox_username}: ${oldNickname} → ${profile.displayName}`);
                    }
                }

                if (user.roblox_nickname) {
                    const nickname = user.roblox_nickname;

                    const patterns = [
                        `DV_${nickname}`,
                        `DVx${nickname}`,
                        `DV${nickname}`,
                        `${nickname}_DV`,
                        `${nickname}xDV`,
                        `${nickname}DV`
                    ];

                    const isVerified = patterns.some(pattern =>
                        nickname.toLowerCase() === pattern.toLowerCase()
                    );

                    if (isVerified) {
                        user.verified = true;
                        updated = true;
                        console.log(`✅ Auto-verified ${user.roblox_username} with nickname: ${nickname}`);
                    } else {
                        if (user.verified) {
                            user.verified = false;
                            updated = true;
                            console.log(`❌ Auto-unverified ${user.roblox_username} with nickname: ${nickname}`);
                        }
                    }
                }

                await robloxAPI.delay(1000);
            }
        }

        if (updated) {
            fs.writeFileSync(databasePath, JSON.stringify(data, null, 2));
            console.log('💾 Database updated with new verifications');
        } else {
            console.log('ℹ️ No new verifications');
        }

    } catch (error) {
        console.error('❌ Error updating verifications:', error);
    }
}

module.exports = {
    verifyUser,
    updateVerifications
};