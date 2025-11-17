const fs = require('fs');
const path = require('path');
const verificationService = require('./verifyUser');
const databasePath = path.join(__dirname, '../../database/username.json');

if (!verificationService || typeof verificationService.verifyUser !== 'function') {
    console.error('❌ Critical Error: verificationService tidak ter-load dengan benar');
    process.exit(1);
}

const VERIFIED_ROLE_ID = '1405032359589449800';
const REGISTERED_ROLE_ID = '996367985759486042';

const loggedRegistered = new Set();
const loggedVerified = new Set();
const loggedNoVerified = new Set();

async function assignVerifiedRole(client, userid) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return console.log('❌ Guild not found'), false;

        const member = await guild.members.fetch(userid).catch(() => null);
        // if (!member) return console.log(`❌ Member ${userid} not found`), false;

        if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
            if (!loggedVerified.has(member.user.username)) {
                loggedVerified.add(member.user.username);
            }
            return true;
        }

        await member.roles.add(VERIFIED_ROLE_ID);
        console.log(`✅ Assigned verified role to ${member.user.username}`);
        return true;
    } catch (e) {
        console.error(`❌ Error assigning verified role: ${e.message}`);
        return false;
    }
}

async function assignRegisteredRole(client, userid) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return console.log('❌ Guild not found'), false;

        const member = await guild.members.fetch(userid).catch(() => null);
        // if (!member) return console.log(`❌ Member ${userid} not found`), false;

        if (member.roles.cache.has(REGISTERED_ROLE_ID)) {
            if (!loggedRegistered.has(member.user.username)) {
                loggedRegistered.add(member.user.username);
            }
            return true;
        }

        await member.roles.add(REGISTERED_ROLE_ID);
        console.log(`✅ Assigned registered role to ${member.user.username}`);
        return true;
    } catch (e) {
        // console.error(`❌ Error assigning registered role: ${e.message}`);
        return false;
    }
}

async function removeVerifiedRole(client, userid) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return console.log('❌ Guild not found'), false;

        const member = await guild.members.fetch(userid).catch(() => null);
        // if (!member) return console.log(`❌ Member ${userid} not found`), false;

        if (!member.roles.cache.has(VERIFIED_ROLE_ID)) {
            if (!loggedNoVerified.has(member.user.username)) {
                console.log(`ℹ️ ${member.user.username} has no verified role`);
                loggedNoVerified.add(member.user.username);
            }
            return true;
        }

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
        console.log('🎭 Starting role update process...');
        
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
            console.log('❌ Guild not found for role updates');
            return;
        }

        const fs = require('fs');
        
        if (!fs.existsSync(databasePath)) {
            console.log('❌ Database file not found for role updates');
            return;
        }

        const fileContent = fs.readFileSync(databasePath, 'utf8');
        if (!fileContent.trim()) {
            console.log('ℹ️ No users in database for role updates');
            return;
        }

        const users = JSON.parse(fileContent);
        let updatedCount = 0;
        let errorCount = 0;

        const normalizedUsers = users.map(user => ({
            ...user,
            userid: String(user.userid)
        }));

        for (const user of normalizedUsers) {
            try {
                if (!user.userid) {
                    console.warn(`⚠️ Skipping user with no userid: ${user.username}`);
                    continue;
                }

                const member = await guild.members.fetch(user.userid).catch(() => null);
                if (!member) {
                    console.log(`ℹ️ Member ${user.userid} (${user.username}) not in guild`);
                    continue;
                }

                if (!verificationService || typeof verificationService.verifyUser !== 'function') {
                    throw new Error('verificationService.verifyUser is not a function');
                }

                const isVerified = await verificationService.verifyUser(user.userid, guild.id);
                
                if (isVerified) {
                    await assignVerifiedRole(guild.client, user.userid);
                } else {
                    await removeVerifiedRole(guild.client, user.userid);
                }
                
                updatedCount++;
                
            } catch (error) {
                console.error(`❌ Error updating roles for user ${user.userid} (${user.username}):`, error.message);
                errorCount++;
            }
        }

        console.log(`✅ Role update completed: ${updatedCount} users processed, ${errorCount} errors`);

    } catch (error) {
        console.error('❌ Error in role update process:', error);
    }
}
module.exports = { assignVerifiedRole, assignRegisteredRole, removeVerifiedRole, updateRoles, VERIFIED_ROLE_ID, REGISTERED_ROLE_ID };
