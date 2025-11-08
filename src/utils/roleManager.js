const fs = require('fs');
const path = require('path');
const { Client } = require('discord.js');

const databasePath = path.join(__dirname, '../database/username.json');

const VERIFIED_ROLE_ID = 'YOUR_VERIFIED_ROLE_ID_HERE'; // Ganti dengan role ID Discord

async function assignVerifiedRole(client, userid) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) {
            console.log('❌ No guild found');
            return false;
        }

        const member = await guild.members.fetch(userid);
        if (!member) {
            console.log(`❌ Member ${userid} not found in guild`);
            return false;
        }

        if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
            console.log(`✅ Member ${userid} already has verified role`);
            return true;
        }

        await member.roles.add(VERIFIED_ROLE_ID);
        console.log(`✅ Assigned verified role to ${member.user.username} (${userid})`);
        return true;

    } catch (error) {
        console.error(`❌ Error assigning role to ${userid}:`, error.message);
        return false;
    }
}

async function removeVerifiedRole(client, userid) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) {
            console.log('❌ No guild found');
            return false;
        }

        const member = await guild.members.fetch(userid);
        if (!member) {
            console.log(`❌ Member ${userid} not found in guild`);
            return false;
        }

        if (!member.roles.cache.has(VERIFIED_ROLE_ID)) {
            console.log(`ℹ️ Member ${userid} doesn't have verified role`);
            return true;
        }

        await member.roles.remove(VERIFIED_ROLE_ID);
        console.log(`❌ Removed verified role from ${member.user.username} (${userid})`);
        return true;

    } catch (error) {
        console.error(`❌ Error removing role from ${userid}:`, error.message);
        return false;
    }
}

async function updateRoles(client) {
    try {
        console.log('🔄 Updating roles for all users...');

        let data = [];
        if (fs.existsSync(databasePath)) {
            const fileContent = fs.readFileSync(databasePath, 'utf8');
            if (fileContent.trim()) {
                data = JSON.parse(fileContent);
            }
        }

        for (const user of data) {
            if (user.verified) {
                await assignVerifiedRole(client, user.userid);
            } else {
                await removeVerifiedRole(client, user.userid);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('✅ Role updates completed');

    } catch (error) {
        console.error('❌ Error updating roles:', error);
    }
}

async function syncUserRole(client, userid) {
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
            return;
        }

        if (user.verified) {
            await assignVerifiedRole(client, userid);
        } else {
            await removeVerifiedRole(client, userid);
        }

    } catch (error) {
        console.error(`❌ Error syncing role for ${userid}:`, error);
    }
}

module.exports = {
    assignVerifiedRole,
    removeVerifiedRole,
    updateRoles,
    syncUserRole,
    VERIFIED_ROLE_ID
};
