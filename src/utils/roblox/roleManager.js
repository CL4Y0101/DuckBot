const fs = require('fs');
const path = require('path');
const verificationService = require('./verifyUser');
const databasePath = path.join(__dirname, '../../database/username.json');
const guildDatabasePath = path.join(__dirname, '../../database/guild.json');
const logStateFile = path.join(__dirname, '../../database/roleUpdateLogState.json');

if (!verificationService || typeof verificationService.verifyUser !== 'function') {
    console.error('❌ Critical Error: verificationService tidak ter-load dengan benar');
    process.exit(1);
}

function getLogState() {
    try {
        if (fs.existsSync(logStateFile)) {
            return JSON.parse(fs.readFileSync(logStateFile, 'utf8'));
        }
    } catch (error) {
        console.error('⚠️ Error reading log state file:', error.message);
    }
    return {
        notInGuild: [],
        verified: [],
        notVerified: [],
        timeout: []
    };
}

function saveLogState(state) {
    try {
        fs.writeFileSync(logStateFile, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('⚠️ Error saving log state file:', error.message);
    }
}

function getRoleIds(guildId) {
    try {
        if (!fs.existsSync(guildDatabasePath)) {
            return {
                verified: '1405032359589449800',
                registered: '996367985759486042'
            };
        }
        const raw = fs.readFileSync(guildDatabasePath, 'utf8');
        const guildData = raw.trim() ? JSON.parse(raw) : {};

        let guildConfig = null;
        if (Array.isArray(guildData)) {
            for (const item of guildData) {
                if (item && typeof item === 'object' && item[guildId]) {
                    guildConfig = item[guildId];
                    break;
                }
            }
        } else if (guildData && typeof guildData === 'object') {
            guildConfig = guildData[guildId] || null;
            if (!guildConfig) {
                for (const key of Object.keys(guildData)) {
                    const val = guildData[key];
                    if (Array.isArray(val)) {
                        for (const item of val) {
                            if (item && typeof item === 'object' && item[guildId]) {
                                guildConfig = item[guildId];
                                break;
                            }
                        }
                        if (guildConfig) break;
                    }
                }
            }
        }

        if (guildConfig && guildConfig.Roles) {
            return {
                verified: guildConfig.Roles.verified || '1405032359589449800',
                // support both 'registered' and older 'unverified' naming
                registered: guildConfig.Roles.registered || guildConfig.Roles.unverified || '996367985759486042',
                venityRole: guildConfig.Roles.venityRole || '996406094618443807'
            };
        }
        return {
            verified: '1405032359589449800',
            registered: '996367985759486042',
            venityRole: '996406094618443807'
        };
    } catch (error) {
        console.error('❌ Error loading guild config:', error);
        return {
            verified: '1405032359589449800',
            registered: '996367985759486042'
        };
    }
}

const loggedRegistered = new Set();
const loggedVerified = new Set();
const loggedNoVerified = new Set();

async function assignVerifiedRole(client, userid, guildId = null, options = {}) {
    try {
        if (!client || !client.isReady()) {
            return false;
        }

        const guild = client.guilds.cache.get(guildId || process.env.GUILD_ID);
        if (!guild) return false;

        const roleIds = getRoleIds(guild.id);
        const VERIFIED_ROLE_ID = roleIds.verified;

        const member = await guild.members.fetch(userid).catch(() => null);
        if (!member) return false;

        if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
            if (!loggedVerified.has(member.user.username)) {
                loggedVerified.add(member.user.username);
            }
            return true;
        }

        await member.roles.add(VERIFIED_ROLE_ID).catch(err => {
            if (!options.silent) console.error(`⚠️ Failed to add role to ${member.user.username}:`, err.message);
        });
        if (!options.silent) console.log(`✅ Assigned verified role to ${member.user.username}`);
        return true;
    } catch (e) {
        console.error(`❌ Error assigning verified role: ${e.message}`);
        return false;
    }
}

async function assignRegisteredRole(client, userid, guildId = null, options = {}) {
    try {
        const guild = client.guilds.cache.get(guildId || process.env.GUILD_ID);
        if (!guild) return console.log('❌ Guild not found'), false;

        const roleIds = getRoleIds(guild.id);
        const UNVERIFIED_ROLE_ID = roleIds.registered;

        const member = await guild.members.fetch(userid).catch(() => null);
        // if (!member) return console.log(`❌ Member ${userid} not found`), false;

        if (member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
            if (!loggedRegistered.has(member.user.username)) {
                loggedRegistered.add(member.user.username);
            }
            return true;
        }

        await member.roles.add(UNVERIFIED_ROLE_ID);
        if (!options.silent) console.log(`✅ Assigned registered role to ${member.user.username}`);
        return true;
    } catch (e) {
        // console.error(`❌ Error assigning registered role: ${e.message}`);
        return false;
    }
}

async function removeVerifiedRole(client, userid, guildId = null, options = {}) {
    try {
        if (!client || !client.isReady()) {
            return false;
        }

        const guild = client.guilds.cache.get(guildId || process.env.GUILD_ID);
        if (!guild) return false;

        const roleIds = getRoleIds(guild.id);
        const VERIFIED_ROLE_ID = roleIds.verified;

        const member = await guild.members.fetch(userid).catch(() => null);
        if (!member) return false;

        if (!member.roles.cache.has(VERIFIED_ROLE_ID)) {
            if (!loggedNoVerified.has(member.user.username)) {
                if (!options.silent) console.log(`ℹ️ ${member.user.username} has no verified role`);
                loggedNoVerified.add(member.user.username);
            }
            return true;
        }

        await member.roles.remove(VERIFIED_ROLE_ID).catch(err => {
            if (!options.silent) console.error(`⚠️ Failed to remove role from ${member.user.username}:`, err.message);
        });
        if (!options.silent) console.log(`❌ Removed verified role from ${member.user.username}`);
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

        const roleIdsGlobal = getRoleIds(guild.id);
        console.log(`🔎 Role IDs for guild ${guild.id}: verified=${roleIdsGlobal.verified}, registered=${roleIdsGlobal.registered}`);

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

        const logState = getLogState();
        const logsToShow = {
            notInGuild: [],
            verified: [],
            notVerified: []
        };

        for (let i = 0; i < normalizedUsers.length; i++) {
            const user = normalizedUsers[i];
            
            try {
                if (!user.userid) {
                    console.warn(`⚠️ Skipping user with no userid: ${user.username}`);
                    continue;
                }

                
                if (i > 0 && i % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                const memberFetchPromise = guild.members.fetch(user.userid).catch(() => null);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Member fetch timeout')), 5000)
                );
                
                let member;
                try {
                    member = await Promise.race([memberFetchPromise, timeoutPromise]);
                } catch (timeoutError) {
                    errorCount++;
                    continue;
                }

                if (!member) {
                    if (!logState.notInGuild.includes(user.userid) && logsToShow.notInGuild.length < 5) {
                        logsToShow.notInGuild.push(user.userid);
                        console.log(`ℹ️ Member ${user.userid} (${user.username}) not in guild`);
                    }
                    continue;
                }

                if (!verificationService || typeof verificationService.verifyUser !== 'function') {
                    throw new Error('verificationService.verifyUser is not a function');
                }

                const isVerified = await verificationService.verifyUser(user.userid, guild.id);
                
                if (isVerified) {
                    if (!logState.verified.includes(user.userid) && logsToShow.verified.length < 5) {
                        logsToShow.verified.push(user.userid);
                        console.log(`✅ ${user.username} verified with nickname: ${user.roblox_nickname || 'N/A'} (guild: ${guild.id || 'default'})`);
                    }
                    console.log(`➡️ Assigning verified role (${roleIdsGlobal.verified}) to user ${user.userid}`);
                    try {
                        const ok = await assignVerifiedRole(client, user.userid, null, { silent: false });
                        if (!ok) console.warn(`⚠️ assignVerifiedRole returned false for user ${user.userid}`);
                    } catch (e) {
                        console.error(`⚠️ Error calling assignVerifiedRole for ${user.userid}:`, e);
                    }
                } else {
                    if (!logState.notVerified.includes(user.userid) && logsToShow.notVerified.length < 5) {
                        logsToShow.notVerified.push(user.userid);
                        console.log(`❌ ${user.username} not verified (nickname: ${user.roblox_nickname || 'N/A'}) (guild: ${guild.id || 'default'})`);
                    }
                    console.log(`⬅️ Removing verified role (${roleIdsGlobal.verified}) from user ${user.userid}`);
                    try {
                        const ok = await removeVerifiedRole(client, user.userid, null, { silent: false });
                        if (!ok) console.warn(`⚠️ removeVerifiedRole returned false for user ${user.userid}`);
                    } catch (e) {
                        console.error(`⚠️ Error calling removeVerifiedRole for ${user.userid}:`, e);
                    }
                }
                
                updatedCount++;
                
            } catch (error) {
                console.error(`❌ Error updating roles for user ${user.userid} (${user.username}):`, error.message);
                errorCount++;
            }
        }

        logState.notInGuild = [...new Set([...logState.notInGuild, ...logsToShow.notInGuild])];
        logState.verified = [...new Set([...logState.verified, ...logsToShow.verified])];
        logState.notVerified = [...new Set([...logState.notVerified, ...logsToShow.notVerified])];
        saveLogState(logState);

        console.log(`✅ Role update completed: ${updatedCount} users processed, ${errorCount} errors`);

    } catch (error) {
        console.error('❌ Error in role update process:', error);
    }
}
module.exports = { assignVerifiedRole, assignRegisteredRole, removeVerifiedRole, updateRoles, getRoleIds };

