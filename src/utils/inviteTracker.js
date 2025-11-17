const fs = require('fs');
const path = require('path');

const invitesPath = path.join(__dirname, '../database/invites.json');
const guildConfigPath = path.join(__dirname, '../database/guild.json');

class InviteTracker {
    constructor() {
        this.inviteCache = new Map();
        this.userInvites = new Map();
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
                console.log(`ℹ️ Could not determine invite used by ${member.user.username}`);
            }

        } catch (error) {
            console.error('❌ Error tracking member join:', error);
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

            let computedTotalInvites = 0;
            let computedSuccessfulInvites = 0;
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

            const embed = {
                color: 0x00ff00,
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
                        value: `${computedTotalInvites}`,
                        inline: true
                    },
                    {
                        name: '👥 Guild Member #',
                        value: `${member.guild.memberCount}`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString()
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

    getGuildInvites(guildId) {
        const data = this.loadInviteData();
        return data[guildId]?.invites || {};
    }
}

module.exports = new InviteTracker();
