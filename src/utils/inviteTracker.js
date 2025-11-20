const fs = require('fs');
const path = require('path');

const invitesPath = path.join(__dirname, '../database/invites.json');
const guildConfigPath = path.join(__dirname, '../database/guild.json');

class InviteTracker {
    constructor() {
        this.inviteCache = new Map();
        this.userInvites = new Map();
        this.memberInviteMap = new Map();
    }

    loadInviteData() {
        try {
            if (!fs.existsSync(invitesPath)) {
                this.saveInviteData();
                return;
            }
            const data = JSON.parse(fs.readFileSync(invitesPath, 'utf8'));
            return data;
        } catch (error) {
            console.error('❌ Error loading invite data:', error);
            return { "985901035593801749": { invites: {}, users: {} } };
        }
    }

    saveInviteData(data = null) {
        try {
            const saveData = data || this.getCurrentData();
            fs.writeFileSync(invitesPath, JSON.stringify(saveData, null, 2));
        } catch (error) {
            console.error('❌ Error saving invite data:', error);
        }
    }

    getCurrentData() {
        const data = {};
        for (const [guildId, guildData] of this.inviteCache) {
            data[guildId] = {
                invites: Object.fromEntries(guildData.invites),
                users: Object.fromEntries(guildData.users)
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
                users: userMap
            });

            data[guildId].invites = Object.fromEntries(inviteMap);
            data[guildId].users = Object.fromEntries(userMap);
            this.saveInviteData(data);

            console.log(`✅ Invite tracking initialized for guild ${guildId} with ${invites.size} invites`);

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
                            codes: []
                        });
                    }
                    const userData = userStats.get(inviterId);
                    userData.successfulInvites += 1;
                    if (!userData.codes.includes(usedInvite.code)) {
                        userData.codes.push(usedInvite.code);
                    }
                }

                const data = this.loadInviteData();
                data[guildId].invites[usedInvite.code] = inviteData;
                data[guildId].users = Object.fromEntries(userStats);
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
                        name: '👤 Member',
                        value: `<@${member.id}> (${member.user.username})`,
                        inline: true
                    },
                    {
                        name: '🆔 User ID',
                        value: `${member.id}`,
                        inline: true
                    },
                    {
                        name: '📋 Possible Reasons',
                        value: 'Member joined via server discovery, invite expired, or invite was deleted before tracking.',
                        inline: false
                    },
                    {
                        name: '👥 Guild Member #',
                        value: `${member.guild.memberCount}`,
                        inline: true
                    },
                    {
                        name: '📅 Account Created',
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

            let accurateTotalInvites = 0;
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

            let computedTotalInvites = 0;
            const guildCache = this.inviteCache.get(member.guild.id);
            if (guildCache && guildCache.invites) {
                for (const [code, inv] of guildCache.invites) {
                    try {
                        const invObj = inv || {};
                        const invUses = Number(invObj.uses) || 0;
                        if (String(invObj.inviter) === String(inviterId)) {
                            computedTotalInvites += invUses;
                        }
                    } catch (e) {
                    }
                }
            }

            const userStats = this.inviteCache.get(member.guild.id)?.users?.get(inviterId);

            const displayTotalInvites = discordTotalInvites > 0 ? discordTotalInvites : computedTotalInvites;

            const isAccurate = discordTotalInvites > 0 ? (computedTotalInvites === discordTotalInvites) : true;
            const verificationStatus = discordTotalInvites > 0 ? (isAccurate ? '✅ Verified' : '⚠️ May be inaccurate') : '🔄 Tracking';

            const embed = {
                color: isAccurate ? 0x00ff00 : 0xffa500,
                title: '📨 Invite Used',
                fields: [
                    {
                        name: '👤 New Member',
                        value: `<@${member.id}> (${member.user.username})`,
                        inline: true
                    },
                    {
                        name: '🎯 Inviter',
                        value: inviter ? `<@${inviter.id}> (${inviter.username})` : 'Unknown',
                        inline: true
                    },
                    {
                        name: '🔗 Invite Code',
                        value: `\`${invite.code}\``,
                        inline: true
                    },
                    {
                        name: '📊 Total Invites',
                        value: `${displayTotalInvites}`,
                        inline: true
                    },
                    {
                        name: '🔍 Verification',
                        value: verificationStatus,
                        inline: true
                    },
                    {
                        name: '👥 Guild Member #',
                        value: `${member.guild.memberCount}`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: discordTotalInvites > 0 ? `Discord: ${discordTotalInvites} | Tracked: ${computedTotalInvites}` : 'Invite tracking active'
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

    getGuildInvites(guildId) {
        const data = this.loadInviteData();
        return data[guildId]?.invites || {};
    }
}

module.exports = new InviteTracker();
