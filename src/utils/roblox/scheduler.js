const verificationService = require('./verifyUser');
const { updateRoles, removeVerifiedRole, getRoleIds } = require('./roleManager');
const MinecraftAPI = require('../minecraft/minecraftAPI');
const fs = require('fs');
const path = require('path');
const { triggerImmediateBackup } = require('../github/backup');

const CHECK_INTERVAL = 5 * 60 * 1000;
const INITIAL_DELAY = 30 * 1000;

let client = null;
let intervalId = null;
let isRunning = false;

const venityDbPath = path.join(__dirname, '../../database/venity.json');

async function runVenityCheck(discordClient) {
    if (!discordClient || !discordClient.isReady()) return;

    try {
        if (!fs.existsSync(venityDbPath)) return;
        const raw = fs.readFileSync(venityDbPath, 'utf8');
        if (!raw || !raw.trim()) return;
        let data = JSON.parse(raw);
        if (!Array.isArray(data)) return;

        const api = new MinecraftAPI();
        let changed = false;

        for (const entry of data) {
            try {
                if (!entry || !entry.userid) continue;
                if (!entry.verified) continue;

                const playerId = entry.playerId || null;
                let profile = null;
                if (playerId) {
                    profile = await api.getProfileByUUID(String(playerId));
                } else if (entry.playerName) {
                    const allGuilds = await api.getAllBebekGuilds();
                    for (const g of allGuilds || []) {
                        if (!g || !Array.isArray(g.members)) continue;
                        const m = g.members.find(mem => mem.playerName && String(mem.playerName).toLowerCase() === String(entry.playerName).toLowerCase());
                        if (m) {
                            profile = await api.getProfileByUUID(String(m.playerId));
                            break;
                        }
                    }
                }

                const stillInGuild = !!(profile && profile.guild && profile.guild.id);

                if (!stillInGuild) {
                    entry.verified = false;
                    changed = true;

                    try {
                        const guild = discordClient.guilds.cache.get(process.env.GUILD_ID);
                        if (guild) {
                            const roles = getRoleIds(guild.id);
                            const venityRoleId = roles.venityRole;
                            const member = await guild.members.fetch(entry.userid).catch(() => null);
                            if (member) {
                                if (venityRoleId && member.roles.cache.has(venityRoleId)) {
                                    await member.roles.remove(venityRoleId).catch(err => console.error('Failed to remove venity role:', err));
                                }
                                await removeVerifiedRole(discordClient, entry.userid, null, { silent: true });
                            }
                        }
                    } catch (err) {
                        console.error('Error removing roles for Venity user:', err);
                    }
                }
            } catch (err) {
                console.error('Error checking Venity entry:', err);
            }
        }

        if (changed) {
            try {
                fs.writeFileSync(venityDbPath, JSON.stringify(data, null, 2));
            } catch (e) {
                console.error('Failed to write venity.json after venity check:', e);
            }
            try { await triggerImmediateBackup(); } catch (e) { console.error('triggerImmediateBackup failed after venity changes:', e); }
        }
    } catch (error) {
        console.error('runVenityCheck error:', error);
    }
}

function startScheduler(discordClient) {
    if (isRunning) {
        console.log('⚠️ Scheduler is already running');
        return;
    }

    client = discordClient;
    isRunning = true;

    console.log(`⏰ Starting verification scheduler (first check in ${INITIAL_DELAY/1000}s, then every ${CHECK_INTERVAL/1000/60} minutes)...`);

    setTimeout(() => {
        runVerificationCheck();
        
        intervalId = setInterval(runVerificationCheck, CHECK_INTERVAL);
    }, INITIAL_DELAY);
}

function stopScheduler() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    
    isRunning = false;
    console.log('⏰ Verification scheduler stopped');
}

async function runVerificationCheck() {
    if (!isRunning) return;

    const startTime = Date.now();
    const MAX_TIMEOUT = 4 * 60 * 1000; // 4 minutes max
    
    try {
        console.log('🔄 Running scheduled verification check...');

        if (!client || !client.isReady()) {
            console.warn('⚠️ Discord client not ready, skipping verification check');
            return;
        }

        const verificationPromise = (async () => {
            await verificationService.updateVerifications(process.env.GUILD_ID);

            if (client && client.isReady()) {
                await updateRoles(client);
            } else {
                console.warn('⚠️ Discord client disconnected during verification, skipping role update');
            }

            try {
                await runVenityCheck(client);
            } catch (e) {
                console.error('⚠️ Error during Venity check:', e.message || e);
            }
        })();

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Verification check timeout - exceeded max duration')), MAX_TIMEOUT)
        );

        await Promise.race([verificationPromise, timeoutPromise]);

        const duration = Date.now() - startTime;
        console.log(`✅ Scheduled verification check completed in ${duration}ms`);

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Error in scheduled verification check (duration: ${duration}ms):`, error.message);
        
        if (error.response) {
            console.error('📡 API Response:', error.response.status, error.response.statusText);
        }

        if (error.message.includes('timeout')) {
            console.warn('⚠️ Verification check timed out, will retry on next interval');
        }
    }
}

function getSchedulerStatus() {
    const nextCheck = intervalId ? new Date(Date.now() + CHECK_INTERVAL).toLocaleTimeString() : 'Not running';
    
    return {
        running: isRunning,
        interval: CHECK_INTERVAL / 1000 / 60, 
        nextCheck: nextCheck,
        started: isRunning ? new Date().toLocaleString() : 'Not started'
    };
}

process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, stopping scheduler...');
    stopScheduler();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, stopping scheduler...');
    stopScheduler();
    process.exit(0);
});

module.exports = {
    startScheduler,
    stopScheduler,
    runVerificationCheck,
    getSchedulerStatus,
    forceVerificationCheck: runVerificationCheck
};