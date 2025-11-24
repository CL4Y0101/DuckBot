const fs = require('fs');
const path = require('path');

const invitesPath = path.join(__dirname, '../database/invites.json');
const guildConfigPath = path.join(__dirname, '../database/guild.json');

class InviteTracker {
    constructor() {
        this.inviteCache = new Map();
        this.userInvites = new Map();
        this.memberInviteMap = new Map();
        this.refreshIntervals = new Map();
        this.defaultRefreshMs = 5 * 60 * 1000; // 5 minutes
    }

    loadInviteData() {
        try {
            if (!fs.existsSync(invitesPath)) {
                fs.writeFileSync(invitesPath, JSON.stringify({}, null, 2));
                return {};
            }
            const raw = fs.readFileSync(invitesPath, 'utf8').trim();
            if (!raw) return {};
            const rawData = JSON.parse(raw);

            for (const guildId in rawData) {
                if (rawData[guildId].users) {
                    for (const userId in rawData[guildId].users) {
                        const user = rawData[guildId].users[userId];
                        if (user.uniqueInvitedMembersArray) {
                            user.uniqueInvitedMembers = new Set(user.uniqueInvitedMembersArray);
                            delete user.uniqueInvitedMembersArray;
                        } else {
                            user.uniqueInvitedMembers = new Set();
                        }
                    }
                }
            }
            return rawData || {};
        } catch (error) {
            console.error('❌ Error loading invite data:', error);
            return {};
        }
    }

    saveInviteData(data = null) {
        try {
            const saveData = data || this.getCurrentData();

            for (const guildId in saveData) {
                if (saveData[guildId].users) {
                    for (const userId in saveData[guildId].users) {
                        const user = saveData[guildId].users[userId];
                        if (user.uniqueInvitedMembers && user.uniqueInvitedMembers instanceof Set) {
                            user.uniqueInvitedMembersArray = Array.from(user.uniqueInvitedMembers);
                            delete user.uniqueInvitedMembers;
                        }
                    }
                }
            }
            fs.writeFileSync(invitesPath, JSON.stringify(saveData, null, 2));
        } catch (error) {
            console.error('❌ Error saving invite data:', error);
        }
    }

    getCurrentData() {
        const data = {};
        for (const [guildId, guildData] of this.inviteCache) {
            let usersObj = {};
            if (guildData.users instanceof Map) {
                for (const [userId, userData] of guildData.users) {
                    usersObj[userId] = {
                        totalInvites: userData.totalInvites || 0,
                        successfulInvites: userData.successfulInvites || 0,
                        codes: userData.codes || [],
                        uniqueInvitedMembersArray: userData.uniqueInvitedMembers ? Array.from(userData.uniqueInvitedMembers) : []
                    };
                }
            } else {
                usersObj = guildData.users || {};
            }

            const invitesObj = guildData.invites instanceof Map ? Object.fromEntries(guildData.invites) : (guildData.invites || {});
            data[guildId] = {
                invites: invitesObj,
                users: usersObj,
                lastUpdated: guildData.lastUpdated || new Date().toISOString()
            };
        }
        return data;
    }

    async initializeGuild(client, guildId) {
        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                console.log(`❌ Guild ${guildId} not found for invite tracking`);
                return;
            }

            const data = this.loadInviteData();
            if (!data[guildId]) {
                data[guildId] = { invites: {}, users: {} };
            }

            const guildConfig = this.getGuildConfig(guildId);

            let invites;
            let inviteMap = new Map();
            let userMap = new Map();

            try {
                invites = await guild.invites.fetch();
                invites.forEach(invite => {
                    inviteMap.set(invite.code, {
                        code: invite.code,
                        inviter: invite.inviter?.id || 'unknown',
                        uses: invite.uses,
                        maxUses: invite.maxUses,
                        createdAt: invite.createdAt?.toISOString(),
                        expiresAt: invite.expiresAt?.toISOString()
                    });

                    const inviterId = invite.inviter?.id;
                    if (inviterId) {
                        if (!userMap.has(inviterId)) {
                            userMap.set(inviterId, {
                                totalInvites: 0,
                                successfulInvites: 0,
                                codes: []
                            });
                        }
                        const userData = userMap.get(inviterId);
                        userData.totalInvites += invite.uses;
                        userData.successfulInvites += invite.uses;
                        userData.codes.push(invite.code);
                    }
                });

                this.inviteCache.set(guildId, {
                    invites: inviteMap,
                    users: userMap,
                    lastUpdated: new Date().toISOString()
                });

                data[guildId].invites = Object.fromEntries(inviteMap);
                data[guildId].users = Object.fromEntries(userMap);
                this.saveInviteData(data);

                console.log(`✅ Invite tracking initialized for guild ${guildId} with ${invites.size} invites`);
                if (guildConfig?.tracking?.autoRefresh !== false) {
                    this.startAutoRefresh(client, guildId);
                }
            } catch (err) {
                console.warn(`⚠️ Could not fetch invites from Discord for guild ${guildId}, falling back to disk data.`);
                // populate from disk if available
                const diskInvites = data[guildId]?.invites || {};
                const diskUsers = data[guildId]?.users || {};

                for (const [code, inv] of Object.entries(diskInvites)) {
                    inviteMap.set(code, inv);
                }
                for (const [uid, udata] of Object.entries(diskUsers)) {
                    userMap.set(uid, udata);
                }

                this.inviteCache.set(guildId, {
                    invites: inviteMap,
                    users: userMap,
                    lastUpdated: new Date().toISOString()
                });

                console.log(`ℹ️ Invite tracking initialized for guild ${guildId} from disk: ${inviteMap.size} invites`);
                if (guildConfig?.tracking?.autoRefresh !== false) {
                    this.startAutoRefresh(client, guildId);
                }
            }

        } catch (error) {
            console.error('❌ Error initializing invite tracking:', error);
        }
    }


    async trackMemberJoin(client, member) {
        try {
            const guildId = member.guild.id;

            const guildConfig = this.getGuildConfig(guildId);
            if (!guildConfig?.tracking?.enabled) {
                return;
            }

            const oldInvites = this.inviteCache.get(guildId)?.invites;
            if (!oldInvites) {
                console.log(`⚠️ No cached invites for guild ${guildId}`);
                return;
            }

            const newInvites = await member.guild.invites.fetch();
            let usedInvite = null;
            let inviterId = null;

            for (const [code, oldInvite] of oldInvites) {
                const newInvite = newInvites.get(code);
                if (newInvite && newInvite.uses > oldInvite.uses) {
                    usedInvite = newInvite;
                    inviterId = newInvite.inviter?.id;
                    break;
                }
            }

            if (usedInvite) {
                const inviteData = {
                    code: usedInvite.code,
                    inviter: inviterId,
                    uses: usedInvite.uses,
                    maxUses: usedInvite.maxUses,
                    createdAt: usedInvite.createdAt?.toISOString(),
                    expiresAt: usedInvite.expiresAt?.toISOString()
                };

                oldInvites.set(usedInvite.code, inviteData);

                const userStats = this.inviteCache.get(guildId).users;
                if (inviterId) {
                    if (!userStats.has(inviterId)) {
                        userStats.set(inviterId, {
                            totalInvites: 0,
                            successfulInvites: 0,
                            codes: [],
                            uniqueInvitedMembers: new Set()
                        });
                    }
                    const userData = userStats.get(inviterId);
                    userData.successfulInvites += 1;
                    if (!userData.codes.includes(usedInvite.code)) {
                        userData.codes.push(usedInvite.code);
                    }
                    // Add member.id to unique invited members
                    userData.uniqueInvitedMembers.add(member.id);
                }

                const data = this.loadInviteData();
                data[guildId].invites[usedInvite.code] = inviteData;

                // Convert Set to array for saving
                const saveUserStats = {};
                for (const [userId, userData] of userStats.entries()) {
                    saveUserStats[userId] = {
                        totalInvites: userData.totalInvites,
                        successfulInvites: userData.successfulInvites,
                        codes: userData.codes,
                        uniqueInvitedMembersArray: Array.from(userData.uniqueInvitedMembers || [])
                    };
                }
                data[guildId].users = saveUserStats;

                this.saveInviteData(data);

                await this.logInviteUsage(client, member, usedInvite, inviterId, guildConfig.tracking.channel);

            } else {
                await this.logUnknownInvite(client, member, guildConfig.tracking.channel);
            }

        } catch (error) {
            console.error('❌ Error tracking member join:', error);
        }
    }

    async logUnknownInvite(client, member, logChannelId) {
        try {
            if (!logChannelId) {
                console.log(`ℹ️ Could not determine invite used by ${member.user.username} (${member.id}). Possible reasons: member joined via server discovery, invite expired, or invite was deleted before tracking.`);
                return;
            }

            const channel = client.channels.cache.get(logChannelId);
            if (!channel) {
                console.log(`❌ Log channel ${logChannelId} not found`);
                return;
            }

            const embed = {
                color: 0xFFA500,
                title: '❓ Unknown Invite Source',
                description: `Member joined but the invite source could not be determined.`,
                fields: [
                    {
                        name: '\`👤\` Member',
                        value: `<@${member.id}> (${member.user.username})`,
                        inline: true
                    },
                    {
                        name: '\`🆔\` User ID',
                        value: `${member.id}`,
                        inline: true
                    },
                    {
                        name: '\`📋\` Possible Reasons',
                        value: 'Member joined via server discovery, invite expired, or invite was deleted before tracking.',
                        inline: false
                    },
                    {
                        name: '\`👥\` Guild Member #',
                        value: `${member.guild.memberCount}`,
                        inline: true
                    },
                    {
                        name: '\`📅\` Account Created',
                        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString()
            };

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Error logging unknown invite:', error);
        }
    }


    async logInviteUsage(client, member, invite, inviterId, logChannelId) {
        try {
            if (!logChannelId) return;

            const channel = client.channels.cache.get(logChannelId);
            if (!channel) {
                console.log(`❌ Log channel ${logChannelId} not found`);
                return;
            }

            const inviter = inviterId ? await client.users.fetch(inviterId).catch(() => null) : null;

            let discordTotalInvites = 0;

            try {
                const currentInvites = await member.guild.invites.fetch();
                for (const [code, inv] of currentInvites) {
                    if (String(inv.inviter?.id) === String(inviterId)) {
                        discordTotalInvites += inv.uses;
                    }
                }
            } catch (error) {
                console.log('⚠️ Could not fetch current Discord invites for verification');
            }

            const userStats = this.inviteCache.get(member.guild.id)?.users?.get(inviterId);

            const uniqueInviteCount = userStats && userStats.uniqueInvitedMembers ? userStats.uniqueInvitedMembers.size : 0;

            const displayTotalInvites = discordTotalInvites > 0 ? discordTotalInvites : uniqueInviteCount;

            const isAccurate = discordTotalInvites > 0 ? (uniqueInviteCount === discordTotalInvites) : true;
            const verificationStatus = discordTotalInvites > 0 ? (isAccurate ? '✅ Verified' : '⚠️ May be inaccurate') : '🔄 Tracking';

            const embed = {
                color: isAccurate ? 0x00ff00 : 0xffa500,
                title: '📨 Invite Used',
                fields: [
                    {
                        name: '\`👤\` New Member',
                        value: `<@${member.id}> (${member.user.username})`,
                        inline: true
                    },
                    {
                        name: '\`🎯\` Inviter',
                        value: inviter ? `<@${inviter.id}> (${inviter.username})` : 'Unknown',
                        inline: true
                    },
                    {
                        name: '\`🔗\` Invite Code',
                        value: `\`${invite.code}\``,
                        inline: true
                    },
                    {
                        name: '\`📊\` Total Invites',
                        value: `${displayTotalInvites}`,
                        inline: true
                    },
                    {
                        name: '\`🔍\` Verification',
                        value: verificationStatus,
                        inline: true
                    },
                    {
                        name: '\`👥\` Guild Member #',
                        value: `${member.guild.memberCount}`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: discordTotalInvites > 0 ? `Discord: ${discordTotalInvites} | Tracked: ${uniqueInviteCount}` : 'Invite tracking active'
                }
            };

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Error logging invite usage:', error);
        }
    }

    getGuildConfig(guildId) {
        try {
            if (!fs.existsSync(guildConfigPath)) return null;
            const data = JSON.parse(fs.readFileSync(guildConfigPath, 'utf8'));
            return data.find(guild => guild[guildId])?.[guildId];
        } catch (error) {
            console.error('❌ Error loading guild config:', error);
            return null;
        }
    }

    getUserStats(guildId, userId) {
        const data = this.loadInviteData();
        return data[guildId]?.users?.[userId] || {
            totalInvites: 0,
            successfulInvites: 0,
            codes: []
        };
    }

    async trackMemberLeave(client, member) {
        try {
            const guildId = member.guild.id;

            const guildConfig = this.getGuildConfig(guildId);
            if (!guildConfig?.tracking?.enabled) {
                return;
            }

            const currentInvites = await member.guild.invites.fetch();
            const data = this.loadInviteData();
            const guildData = data[guildId];

            if (!guildData) return;

            let invitesChanged = false;

            for (const [code, storedInvite] of Object.entries(guildData.invites)) {
                const currentInvite = currentInvites.get(code);
                if (currentInvite) {
                    const storedUses = Number(storedInvite.uses) || 0;
                    const currentUses = Number(currentInvite.uses) || 0;

                    if (currentUses < storedUses) {
                        const inviterId = storedInvite.inviter;
                        if (inviterId && guildData.users[inviterId]) {
                            if (guildData.users[inviterId].successfulInvites > 0) {
                                guildData.users[inviterId].successfulInvites -= 1;
                                invitesChanged = true;
                                console.log(`📉 Decremented invite count for ${inviterId} due to member leave: ${member.user.username} (invite: ${code})`);
                            }
                        }

                        guildData.invites[code].uses = currentUses;
                    }
                }
            }

            if (invitesChanged) {
                this.saveInviteData(data);

                const userStats = this.inviteCache.get(guildId)?.users;
                if (userStats) {
                    for (const [userId, userData] of userStats) {
                        if (guildData.users[userId]) {
                            userData.successfulInvites = guildData.users[userId].successfulInvites;
                        }
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error tracking member leave:', error);
        }
    }

    async refreshGuildInvites(client, guildId) {
        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return;

            const invites = await guild.invites.fetch();
            const inviteMap = new Map();
            const userMap = new Map();

            invites.forEach(invite => {
                inviteMap.set(invite.code, {
                    code: invite.code,
                    inviter: invite.inviter?.id || 'unknown',
                    uses: invite.uses,
                    maxUses: invite.maxUses,
                    createdAt: invite.createdAt?.toISOString(),
                    expiresAt: invite.expiresAt?.toISOString()
                });

                const inviterId = invite.inviter?.id;
                if (inviterId) {
                    if (!userMap.has(inviterId)) {
                        userMap.set(inviterId, {
                            totalInvites: 0,
                            successfulInvites: 0,
                            codes: []
                        });
                    }
                    const userData = userMap.get(inviterId);
                    userData.totalInvites += invite.uses;
                    userData.successfulInvites += invite.uses;
                    userData.codes.push(invite.code);
                }
            });

            this.inviteCache.set(guildId, {
                invites: inviteMap,
                users: userMap,
                lastUpdated: new Date().toISOString()
            });

            const data = this.loadInviteData();
            data[guildId] = data[guildId] || { invites: {}, users: {} };
            data[guildId].invites = Object.fromEntries(inviteMap);
            data[guildId].users = Object.fromEntries(userMap);
            data[guildId].lastUpdated = new Date().toISOString();
            this.saveInviteData(data);

            console.log(`🔄 Refreshed invites for guild ${guildId} (${inviteMap.size} invites)`);
        } catch (error) {
            console.warn(`⚠️ Timeout or error refreshing invites for guild ${guildId}:`, error);
        }
    }

    startAutoRefresh(client, guildId, intervalMs = null) {
        try {
            const ms = intervalMs || this.defaultRefreshMs;
            if (this.refreshIntervals.has(guildId)) return;
            const id = setInterval(() => {
                this.refreshGuildInvites(client, guildId).catch(err => console.error('❌ Error in auto-refresh:', err));
            }, ms);
            this.refreshIntervals.set(guildId, id);
            console.log(`⏱️ Started invite auto-refresh for guild ${guildId} every ${ms}ms`);
        } catch (error) {
            console.error('❌ Error starting auto-refresh:', error);
        }
    }

    stopAutoRefresh(guildId) {
        try {
            const id = this.refreshIntervals.get(guildId);
            if (id) {
                clearInterval(id);
                this.refreshIntervals.delete(guildId);
                console.log(`⏹️ Stopped invite auto-refresh for guild ${guildId}`);
            }
        } catch (error) {
            console.error('❌ Error stopping auto-refresh:', error);
        }
    }

    getGuildInvites(guildId) {
        const data = this.loadInviteData();
        return data[guildId]?.invites || {};
    }
}

module.exports = new InviteTracker();
