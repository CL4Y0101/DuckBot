const fs = require('fs');
const path = require('path');
const databasePath = path.join(__dirname, '../../database/username.json');

const VERIFIED_ROLE_ID = '1405032359589449800'; // Ganti dengan role ID Discord

async function assignVerifiedRole(client, userid) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return console.log('❌ Guild not found'), false;

        const member = await guild.members.fetch(userid).catch(() => null);
        if (!member) return console.log(`❌ Member ${userid} not found`), false;

        if (member.roles.cache.has(VERIFIED_ROLE_ID))
            return console.log(`✅ ${member.user.username} already verified`), true;

        await member.roles.add(VERIFIED_ROLE_ID);
        console.log(`✅ Assigned verified role to ${member.user.username}`);
        return true;
    } catch (e) {
        console.error(`❌ Error assigning verified role: ${e.message}`);
        return false;
    }
}

async function removeVerifiedRole(client, userid) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return console.log('❌ Guild not found'), false;

        const member = await guild.members.fetch(userid).catch(() => null);
        if (!member) return console.log(`❌ Member ${userid} not found`), false;

        if (!member.roles.cache.has(VERIFIED_ROLE_ID))
            return console.log(`ℹ️ ${member.user.username} has no verified role`), true;

        await member.roles.remove(VERIFIED_ROLE_ID);
        console.log(`❌ Removed verified role from ${member.user.username}`);
        return true;
    } catch (e) {
        console.error(`❌ Error removing verified role: ${e.message}`);
        return false;
    }
}

async function updateRoles(client) {
    try {
        console.log('🔄 Syncing roles with verification status...');
        const data = JSON.parse(fs.readFileSync(databasePath, 'utf8') || '[]');

        for (const user of data) {
            if (user.verified) await assignVerifiedRole(client, user.userid);
            else await removeVerifiedRole(client, user.userid);

            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('✅ Role sync completed');
    } catch (e) {
        console.error('❌ Error updating roles:', e);
    }
}

module.exports = { assignVerifiedRole, removeVerifiedRole, updateRoles, VERIFIED_ROLE_ID };
