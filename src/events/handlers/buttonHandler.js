const {
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const databasePath = path.join(__dirname, '../../database/username.json');
const leaderboardModule = require('../../commands/profile/leaderboard');

const leaderboardSessionTimestamps = new Map();
const verifySessionTimestamps = new Map();

let cachedUsers = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

        if (interaction.customId === 'verify_button_setup') {
            const userId = interaction.user.id;

            let data = [];
            if (fs.existsSync(databasePath)) {
                const fileContent = fs.readFileSync(databasePath, 'utf8');
                if (fileContent.trim()) {
                    data = JSON.parse(fileContent);
                }
            }

            const existingUser = data.find(u => u.userid === userId);

            if (existingUser) {
                const robloxProfileUrl = existingUser.roblox_uid ? `https://www.roblox.com/users/${existingUser.roblox_uid}/profile` : null;

                const embed = new EmbedBuilder()
                    .setTitle('`🔍` Your Roblox Verification Status')
                    .setAuthor({
                        name: interaction.user.username,
                        iconURL: interaction.user.displayAvatarURL({
                            dynamic: true
                        }),
                        url: robloxProfileUrl
                    })
                    .setColor(existingUser.verified ? '#00ff00' : '#ff6b6b')
                    .setDescription(
                        `### \`📊\` Account Details\n` +
                        `-# **Discord Username:** \`${interaction.user.username}\`\n` +
                        `-# **Roblox Username:** \`${existingUser.roblox_username}\`\n` +
                        `-# **Roblox Display Name:** \`${existingUser.roblox_nickname || 'Not fetched yet'}\`\n` +
                        `-# **Duck Void:** ${existingUser.verified ? '✅ Verified' : '❌ Not Verified'}`
                    );

                const button = new ButtonBuilder()
                    .setCustomId('reverify_button')
                    .setLabel('Reverify your username')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder().addComponents(button);

                await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            } else {
                const modal = new ModalBuilder()
                    .setCustomId('verify_modal')
                    .setTitle('Verify Your Username');

                const robloxInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Masukkan username Roblox kamu:')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('contoh: luhnox')
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(robloxInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }
        } else if (interaction.customId === 'verify_button_profile') {
            const userId = interaction.user.id;
            let now;
            let timeDiff;

            if (!interaction.message.inGuild()) {
                try {
                    const scheduler = require('../../utils/disableButton/sessionScheduler');
                    if (scheduler && typeof scheduler.clear === 'function') {
                        try {
                            scheduler.clear(interaction.message.id);
                        } catch (e) {
                            scheduler.clear(userId);
                        }
                    }
                } catch (e) {
                    console.error('Failed to clear verify button scheduler:', e);
                }

                now = Date.now();
                const fiveMinutes = 5 * 60 * 1000;
                const lastInteraction = verifySessionTimestamps.get(userId) || interaction.message.createdTimestamp;
                timeDiff = now - lastInteraction;
            }

            let data = [];
            if (fs.existsSync(databasePath)) {
                const fileContent = fs.readFileSync(databasePath, 'utf8');
                if (fileContent.trim()) {
                    data = JSON.parse(fileContent);
                }
            }

            const existingUser = data.find(u => u.userid === userId);

            if (!interaction.message.inGuild() && timeDiff > 5 * 60 * 1000) {

                const disabledButton = new ButtonBuilder()
                    .setCustomId('verify_button_disabled')
                    .setLabel('Verification expired ⏰')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                const disabledRow = new ActionRowBuilder().addComponents(disabledButton);

                await interaction.update({
                    content: '⚠️ Tombol verifikasi ini sudah kadaluarsa setelah 5 menit.',
                    components: [disabledRow],
                    embeds: []
                });

                verifySessionTimestamps.delete(userId);
                return;
            }

            if (!interaction.message.inGuild()) {
                verifySessionTimestamps.set(userId, now);
            }

            if (existingUser) {
                const robloxProfileUrl = existingUser.roblox_uid ? `https://www.roblox.com/users/${existingUser.roblox_uid}/profile` : null;

                const embed = new EmbedBuilder()
                    .setTitle('`🔍` Your Roblox Verification Status')
                    .setAuthor({
                        name: interaction.user.username,
                        iconURL: interaction.user.displayAvatarURL({
                            dynamic: true
                        }),
                        url: robloxProfileUrl
                    })
                    .setColor(existingUser.verified ? '#00ff00' : '#ff6b6b')
                    .setDescription(
                        `### \`📊\` Account Details\n` +
                        `-# **Discord Username:** \`${interaction.user.username}\`\n` +
                        `-# **Roblox Username:** \`${existingUser.roblox_username}\`\n` +
                        `-# **Roblox Display Name:** \`${existingUser.roblox_nickname || 'Not fetched yet'}\`\n` +
                        `-# **Duck Void:** ${existingUser.verified ? '✅ Verified' : '❌ Not Verified'}`
                    );

                const button = new ButtonBuilder()
                    .setCustomId('reverify_button')
                    .setLabel('Reverify your username')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder().addComponents(button);

                await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            } else {
                const modal = new ModalBuilder()
                    .setCustomId('verify_modal')
                    .setTitle('Verify Your Username');

                const robloxInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Masukkan username Roblox kamu:')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('contoh: luhnox')
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(robloxInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }
        }

        if (interaction.customId === 'venity_verify_button') {
            const userId = interaction.user.id;

            const venityDbPath = path.join(__dirname, '../../database/venity.json');
            let data = [];
            if (fs.existsSync(venityDbPath)) {
                const fileContent = fs.readFileSync(venityDbPath, 'utf8');
                if (fileContent.trim()) data = JSON.parse(fileContent);
            }

            const existing = data.find(u => u.userid === userId);
            if (existing) {
                const embed = new EmbedBuilder()
                    .setTitle('`🔍` Your Venity Verification Status')
                    .setColor(existing.xuid ? '#00ff00' : '#ff6b6b')
                    .setDescription(
                        `- **Discord Username:** \`${interaction.user.username}\`\n` +
                        `- **Minecraft Player:** \`${existing.playerName || 'Not set'}\`\n` +
                        `- **Venity PlayerId:** \`${existing.playerId || 'N/A'}\`\n` +
                        `- **xuid:** \`${existing.xuid || 'N/A'}\``
                    );

                const button = new ButtonBuilder()
                    .setCustomId('venity_reverify_button')
                    .setLabel('Reverify your Minecraft name')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder().addComponents(button);

                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            } else {
                const modal = new ModalBuilder()
                    .setCustomId('venity_modal')
                    .setTitle('Venity Verification');

                const nameInput = new TextInputBuilder()
                    .setCustomId('venity_playername')
                    .setLabel('Masukkan Minecraft username kamu:')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('contoh: BenBenKUN24')
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(nameInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }
        }

        if (interaction.customId === 'venity_reverify_button') {
            const modal = new ModalBuilder()
                .setCustomId('venity_modal')
                .setTitle('Venity Reverify');

            const nameInput = new TextInputBuilder()
                .setCustomId('venity_playername')
                .setLabel('Masukkan Minecraft username kamu:')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('contoh: BenBenKUN24')
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(nameInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
        }

        if (interaction.customId === 'reverify_button') {
            const modal = new ModalBuilder()
                .setCustomId('reverify_modal')
                .setTitle('Reverify Your Username');

            const robloxInput = new TextInputBuilder()
                .setCustomId('roblox_username')
                .setLabel('Masukkan username Roblox kamu:')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('contoh: luhnox')
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(robloxInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
        }

        const voiceButtonIds = new Set(['voice_btn_bitrate', 'voice_btn_limit', 'voice_btn_rename', 'voice_btn_region', 'voice_btn_kick', 'voice_btn_claim', 'voice_btn_info', 'voice_btn_transfer', 'voice_btn_privacy', 'voice_btn_trust', 'voice_btn_untrust', 'voice_btn_block', 'voice_btn_unblock']);

        if (voiceButtonIds.has(interaction.customId)) {
            try {
                const member = interaction.member;
                const voiceChannel = member && member.voice && member.voice.channel;

                function loadGuildRaw() {
                    try {
                        const guildConfigPath = path.join(__dirname, '..', '..', 'database', 'guild.json');
                        if (!fs.existsSync(guildConfigPath)) return null;
                        const raw = fs.readFileSync(guildConfigPath, 'utf8');
                        return raw.trim() ? JSON.parse(raw) : null;
                    } catch (e) { console.error('Failed to load guild.json:', e); return null; }
                }

                function saveGuildRaw(parsed) {
                    try {
                        const guildConfigPath = path.join(__dirname, '..', '..', 'database', 'guild.json');
                        fs.writeFileSync(guildConfigPath, JSON.stringify(parsed, null, 2), 'utf8');
                    } catch (e) { console.error('Failed to save guild.json:', e); }
                }

                function getVoiceContainer(parsed, gid) {
                    if (!parsed) return null;
                    if (Array.isArray(parsed)) {
                        for (const item of parsed) {
                            if (item && typeof item === 'object' && item[gid]) return item[gid].voice || null;
                        }
                        return null;
                    }
                    return parsed[gid] ? (parsed[gid].voice || null) : null;
                }

                const parsed = loadGuildRaw();
                const voiceCfg = getVoiceContainer(parsed, interaction.guild.id) || {};
                voiceCfg.ownerToChannel = voiceCfg.ownerToChannel || [];

                let mapping = null;
                if (voiceChannel) mapping = voiceCfg.ownerToChannel.find(o => o.channelId === voiceChannel.id) || null;

                const notOwnerReply = async () => {
                    try {
                        await interaction.reply({ content: '<:fail:1444451615255040061> You are not **Owner** of the channel.', ephemeral: true });
                    } catch (e) { console.error('Failed to send not-owner reply:', e); }
                };

                const notInVoiceReply = async () => {
                    try { await interaction.reply({ content: '<:fail:1444451615255040061> You must be in a voice channel to use this button.', ephemeral: true }); } catch (e) { }
                };

                switch (interaction.customId) {
                    case 'voice_btn_bitrate': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();
                        const modalB = new ModalBuilder().setCustomId('voice_modal_bitrate').setTitle('Set Bitrate');
                        const inputB = new TextInputBuilder().setCustomId('bitrate_input').setLabel('Bitrate (8000 - 128000)').setStyle(TextInputStyle.Short).setPlaceholder('e.g. 64000').setRequired(true);
                        modalB.addComponents(new ActionRowBuilder().addComponents(inputB));
                        await interaction.showModal(modalB);
                        break;
                    }
                    case 'voice_btn_limit': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();
                        const modalL = new ModalBuilder().setCustomId('voice_modal_limit').setTitle('Set User Limit');
                        const inputL = new TextInputBuilder().setCustomId('limit_input').setLabel('User limit (0 = unlimited, max 99)').setStyle(TextInputStyle.Short).setPlaceholder('e.g. 10').setRequired(true);
                        modalL.addComponents(new ActionRowBuilder().addComponents(inputL));
                        await interaction.showModal(modalL);
                        break;
                    }
                    case 'voice_btn_rename': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();
                        const modalR = new ModalBuilder().setCustomId('voice_modal_rename').setTitle('Rename Channel');
                        const inputR = new TextInputBuilder().setCustomId('name_input').setLabel('New channel name').setStyle(TextInputStyle.Short).setPlaceholder("e.g. luhnox's Hangout").setRequired(true);
                        modalR.addComponents(new ActionRowBuilder().addComponents(inputR));
                        await interaction.showModal(modalR);
                        break;
                    }
                    case 'voice_btn_region': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();
                        const options = [
                            { label: 'Automatic', value: 'auto' },
                            { label: 'Brazil', value: 'brazil' },
                            { label: 'Hong Kong', value: 'hongkong' },
                            { label: 'India', value: 'india' },
                            { label: 'Japan', value: 'japan' },
                            { label: 'Rotterdam', value: 'rotterdam' },
                            { label: 'Singapore', value: 'singapore' },
                            { label: 'South Africa', value: 'southafrica' },
                            { label: 'Sydney', value: 'sydney' },
                            { label: 'US Central', value: 'us_central' },
                            { label: 'US East', value: 'us_east' },
                            { label: 'US South', value: 'us_south' },
                            { label: 'US West', value: 'us_west' }
                        ];
                        const menu = new StringSelectMenuBuilder().setCustomId('voice_select_region').setPlaceholder('Select a region').addOptions(options.map(o => ({ label: o.label, value: o.value })));
                        const row = new ActionRowBuilder().addComponents(menu);
                        await interaction.reply({ content: 'Select a region for your channel:', components: [row], ephemeral: true });
                        break;
                    }
                    case 'voice_btn_kick': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();
                        const members = [...voiceChannel.members.values()].filter(m => m.id !== member.id);
                        if (members.length === 0) return await interaction.reply({ content: `<:fail:1444451615255040061> There's no other user in the channel.`, ephemeral: true });
                        const options = members.slice(0, 25).map(m => ({ label: `${m.user.username}`, value: m.id }));
                        const menu = new StringSelectMenuBuilder().setCustomId('voice_select_kick').setPlaceholder('Select a user to kick').setMinValues(1).setMaxValues(1).addOptions(options);
                        const row = new ActionRowBuilder().addComponents(menu);
                        await interaction.reply({ content: 'Select a user to kick from voice:', components: [row], ephemeral: true });
                        break;
                    }
                    case 'voice_btn_claim': {
                        if (!voiceChannel) return await notInVoiceReply();

                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }

                        if (mapping.ownerId && mapping.ownerId === member.id) return await interaction.reply({ content: 'You are being **owner** in this channel.', ephemeral: true });

                        let currentOwnerPresent = false;
                        if (mapping && mapping.ownerId) {
                            currentOwnerPresent = voiceChannel.members.has(mapping.ownerId);
                        }
                        if (mapping && mapping.ownerId && currentOwnerPresent) return await interaction.reply({ content: '<:fail:1444451615255040061> Owner is still in the channel, claim is not allowed.', ephemeral: true });

                        try {
                            const botMember = interaction.guild.members.me || await interaction.guild.members.fetch(client.user.id).catch(() => null);
                            const required = [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages];
                            let hasAll = false;
                            if (botMember) {
                                hasAll = voiceChannel.permissionsFor(botMember).has(required, false);
                            }
                            if (!hasAll) {
                                try {
                                    await voiceChannel.permissionOverwrites.edit(client.user.id, {
                                        Connect: true,
                                        ManageChannels: true,
                                        SendMessages: true,
                                        ManageMessages: true
                                    });
                                    if (botMember) hasAll = voiceChannel.permissionsFor(botMember).has(required, false);
                                } catch (err) {
                                    console.error('Failed to set permission overwrites for bot on claim:', err);
                                }
                            }
                            if (!hasAll) {
                                return await interaction.reply({ content: '<:fail:1444451615255040061> Bot does not have the required permissions on this channel to perform claim (Manage Channels / Connect / Send Messages / Manage Messages).', ephemeral: true });
                            }
                        } catch (err) {
                            console.error('Error checking/setting bot permissions for claim:', err);
                        }

                        mapping.ownerId = member.id;
                        mapping.isActive = true;
                        if (parsed) saveGuildRaw(parsed);
                        await interaction.reply({ content: '✅ You are now the owner of this channel.', ephemeral: true });
                        break;
                    }
                    case 'voice_btn_info': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        const embed = new EmbedBuilder().setTitle('Channel Info').setColor('#5865F2')
                            .addFields(
                                { name: 'Name', value: `${voiceChannel.name}`, inline: true },
                                { name: 'Bitrate', value: `${voiceChannel.bitrate || 'N/A'}`, inline: true },
                                { name: 'User Limit', value: `${voiceChannel.userLimit || 0}`, inline: true },
                                { name: 'Owner', value: mapping && mapping.ownerId ? `<@${mapping.ownerId}>` : 'None', inline: true }
                            );
                        await interaction.reply({ embeds: [embed], ephemeral: true });
                        break;
                    }
                    case 'voice_btn_transfer': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();
                        const members = [...voiceChannel.members.values()].filter(m => m.id !== member.id);
                        if (members.length === 0) return await interaction.reply({ content: `<:fail:1444451615255040061> There's no other user in the channel to transfer to.`, ephemeral: true });
                        const options = members.slice(0, 25).map(m => ({ label: `${m.user.username}`, value: m.id }));
                        const menu = new StringSelectMenuBuilder().setCustomId('voice_select_transfer').setPlaceholder('Select a user to transfer ownership to').setMinValues(1).setMaxValues(1).addOptions(options);
                        const row = new ActionRowBuilder().addComponents(menu);
                        await interaction.reply({ content: 'Select a user to become the new owner:', components: [row], ephemeral: true });
                        break;
                    }
                    case 'voice_btn_privacy': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();
                        const dropDownPrivacy = new StringSelectMenuBuilder()
                            .setCustomId('voice_select_privacy')
                            .setPlaceholder('Select Privacy Setting')
                            .addOptions([
                                { label: 'Hide', description: 'You hideing the Voice Channel', value: 'hide' },
                                { label: 'UnHide', description: 'Backto Default setting Voice Channel', value: 'unhide' },
                                { label: 'Lock', description: 'Only Owner can join the Voice Channel', value: 'lock' },
                                { label: 'Unlock', description: 'Backto Default setting Voice Channel', value: 'unlock' }
                            ]);

                        const row = new ActionRowBuilder().addComponents(dropDownPrivacy);
                        await interaction.reply({ content: 'Select a privacy setting for your channel:', components: [row], ephemeral: true });
                        break;
                    }
                    case 'voice_btn_trust': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();

                        mapping.trustedUsers = mapping.trustedUsers || [];
                        const allMembers = await interaction.guild.members.fetch();
                        const availableMembers = allMembers.filter(m => m.id !== member.id && !mapping.trustedUsers.includes(m.id));
                        if (availableMembers.size === 0) return await interaction.reply({ content: '<:fail:1444451615255040061> No users available to trust.', ephemeral: true });
                        const options = availableMembers.map(m => ({ label: `${m.user.username}`, value: m.id })).slice(0, 25);
                        const menu = new StringSelectMenuBuilder().setCustomId('voice_select_trust').setPlaceholder('Select users to trust').setMinValues(1).setMaxValues(Math.min(options.length, 25)).addOptions(options);
                        const row = new ActionRowBuilder().addComponents(menu);
                        await interaction.reply({ content: 'Select users to trust:', components: [row], ephemeral: true });
                        break;
                    }
                    case 'voice_btn_untrust': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();

                        mapping.trustedUsers = mapping.trustedUsers || [];
                        if (mapping.trustedUsers.length === 0) return await interaction.reply({ content: '<:fail:1444451615255040061> No trusted users to remove.', ephemeral: true });
                        const trustedMembers = mapping.trustedUsers.map(id => interaction.guild.members.cache.get(id)).filter(Boolean);
                        const options = trustedMembers.map(m => ({ label: `${m.user.username}`, value: m.id })).slice(0, 25);
                        const menu = new StringSelectMenuBuilder().setCustomId('voice_select_untrust').setPlaceholder('Select trusted users to remove').setMinValues(1).setMaxValues(Math.min(options.length, 25)).addOptions(options);
                        const row = new ActionRowBuilder().addComponents(menu);
                        await interaction.reply({ content: 'Select trusted users to remove:', components: [row], ephemeral: true });
                        break;
                    }
                    case 'voice_btn_block': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();

                        mapping.blockedUsers = mapping.blockedUsers || [];
                        const allMembers = await interaction.guild.members.fetch();
                        const availableMembers = allMembers.filter(m => m.id !== member.id && !mapping.blockedUsers.includes(m.id));
                        if (availableMembers.size === 0) return await interaction.reply({ content: '<:fail:1444451615255040061> No users available to block.', ephemeral: true });
                        const options = availableMembers.map(m => ({ label: `${m.user.username}`, value: m.id })).slice(0, 25);
                        const menu = new StringSelectMenuBuilder().setCustomId('voice_select_block').setPlaceholder('Select users to block').setMinValues(1).setMaxValues(Math.min(options.length, 25)).addOptions(options);
                        const row = new ActionRowBuilder().addComponents(menu);
                        await interaction.reply({ content: 'Select users to block:', components: [row], ephemeral: true });
                        break;
                    }
                    case 'voice_btn_unblock': {
                        if (!mapping) {
                            return await interaction.reply({ content: '<:fail:1444451615255040061> This Channel is not being managed by the bot.', ephemeral: true });
                        }
                        if (!voiceChannel) return await notInVoiceReply();
                        if (!mapping || mapping.ownerId !== member.id) return await notOwnerReply();

                        mapping.blockedUsers = mapping.blockedUsers || [];
                        if (mapping.blockedUsers.length === 0) return await interaction.reply({ content: '<:fail:1444451615255040061> No blocked users to unblock.', ephemeral: true });
                        const blockedMembers = mapping.blockedUsers.map(id => interaction.guild.members.cache.get(id)).filter(Boolean);
                        const options = blockedMembers.map(m => ({ label: `${m.user.username}`, value: m.id })).slice(0, 25);
                        const menu = new StringSelectMenuBuilder().setCustomId('voice_select_unblock').setPlaceholder('Select blocked users to unblock').setMinValues(1).setMaxValues(Math.min(options.length, 25)).addOptions(options);
                        const row = new ActionRowBuilder().addComponents(menu);
                        await interaction.reply({ content: 'Select blocked users to unblock:', components: [row], ephemeral: true });
                        break;
                    }
                }
            } catch (err) {
                console.error('Voice button handler error:', err);
                try { await interaction.reply({ content: '<:fail:1444451615255040061> An error occurred while processing the button.', ephemeral: true }); } catch (e) { }
            }
        }

        if (interaction.isStringSelectMenu()) {
            try {
                const member = interaction.member;
                const voiceChannel = member && member.voice && member.voice.channel;
                if (!voiceChannel) return await interaction.reply({ content: '<:fail:1444451615255040061> You must be in a voice channel to use this.', ephemeral: true });

                const parsed = (function () { try { const p = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'guild.json'), 'utf8'); return p.trim() ? JSON.parse(p) : null; } catch (e) { return null; } })();
                const voiceCfg = (function () { if (!parsed) return null; if (Array.isArray(parsed)) { for (const it of parsed) { if (it && typeof it === 'object' && it[interaction.guild.id]) return it[interaction.guild.id].voice || null } return null } return parsed[interaction.guild.id] ? parsed[interaction.guild.id].voice || null : null })() || { ownerToChannel: [] };
                voiceCfg.ownerToChannel = voiceCfg.ownerToChannel || [];
                const mapping = voiceCfg.ownerToChannel.find(o => o.channelId === voiceChannel.id) || null;

                if (interaction.customId === 'voice_select_region') {
                    if (!mapping || mapping.ownerId !== member.id) return await interaction.reply({ content: '<:fail:1444451615255040061> You are not the owner of this channel.', ephemeral: true });
                    const value = interaction.values[0];
                    const rtcRegion = value === 'auto' ? null : value;
                    try {
                        await voiceChannel.edit({ rtcRegion });
                    } catch (e) { console.error('Failed to edit channel region:', e); }
                    mapping.region = value;
                    if (parsed) fs.writeFileSync(path.join(__dirname, '..', '..', 'database', 'guild.json'), JSON.stringify(parsed, null, 2), 'utf8');
                    await interaction.reply({ content: `✅ Region diubah menjadi **${value}**`, ephemeral: true });
                } else if (interaction.customId === 'voice_select_kick') {
                    if (!mapping || mapping.ownerId !== member.id) return await interaction.reply({ content: '<:fail:1444451615255040061> You are not the owner of this channel.', ephemeral: true });
                    const targetId = interaction.values[0];
                    const targetMember = voiceChannel.members.get(targetId);
                    if (!targetMember) return await interaction.reply({ content: '<:fail:1444451615255040061> User not found in the voice channel.', ephemeral: true });
                    try { await targetMember.voice.setChannel(null); } catch (e) { console.error('Failed to kick member:', e); }
                    await interaction.reply({ content: `✅ <@${targetId}> has been kicked from the voice channel.`, ephemeral: true });
                } else if (interaction.customId === 'voice_select_transfer') {
                    if (!mapping || mapping.ownerId !== member.id) return await interaction.reply({ content: '<:fail:1444451615255040061> You are not the owner of this channel.', ephemeral: true });
                    const targetId = interaction.values[0];
                    const targetMember = voiceChannel.members.get(targetId);
                    if (!targetMember) return await interaction.reply({ content: '<:fail:1444451615255040061> User not found in the voice channel.', ephemeral: true });
                    mapping.ownerId = targetId;
                    if (parsed) fs.writeFileSync(path.join(__dirname, '..', '..', 'database', 'guild.json'), JSON.stringify(parsed, null, 2), 'utf8');
                    await interaction.reply({ content: `✅ Ownership has been transferred to <@${targetId}>.`, ephemeral: true });
                } else if (interaction.customId === 'voice_select_privacy') {
                    if (!mapping || mapping.ownerId !== member.id) return await interaction.reply({ content: '<:fail:1444451615255040061> You are not the owner of this channel.', ephemeral: true });
                    const value = interaction.values[0];
                    switch (value) {
                        case 'hide':
                            try {
                                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { ViewChannel: false });
                                await interaction.reply({ content: '✅ Channel hidden.', ephemeral: true });
                            } catch (e) {
                                console.error('Failed to hide channel:', e);
                                await interaction.reply({ content: '<:fail:1444451615255040061> Failed to hide channel.', ephemeral: true });
                            }
                            break;
                        case 'unhide':
                            try {
                                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { ViewChannel: null });
                                await interaction.reply({ content: '✅ Channel unhidden.', ephemeral: true });
                            } catch (e) {
                                console.error('Failed to unhide channel:', e);
                                await interaction.reply({ content: '<:fail:1444451615255040061> Failed to unhide channel.', ephemeral: true });
                            }
                            break;
                        case 'lock':
                            try {
                                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: false });
                                await interaction.reply({ content: '✅ Channel locked.', ephemeral: true });
                            } catch (e) {
                                console.error('Failed to lock channel:', e);
                                await interaction.reply({ content: '<:fail:1444451615255040061> Failed to lock channel.', ephemeral: true });
                            }
                            break;
                        case 'unlock':
                            try {
                                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: null });
                                await interaction.reply({ content: '✅ Channel unlocked.', ephemeral: true });
                            } catch (e) {
                                console.error('Failed to unlock channel:', e);
                                await interaction.reply({ content: '<:fail:1444451615255040061> Failed to unlock channel.', ephemeral: true });
                            }
                            break;
                    }
                } else if (interaction.customId === 'voice_select_trust') {
                    if (!mapping || mapping.ownerId !== member.id) return await interaction.reply({ content: '<:fail:1444451615255040061> You are not the owner of this channel.', ephemeral: true });
                    mapping.trustedUsers = mapping.trustedUsers || [];
                    const selectedIds = interaction.values;
                    mapping.trustedUsers.push(...selectedIds);
                    if (parsed) fs.writeFileSync(path.join(__dirname, '..', '..', 'database', 'guild.json'), JSON.stringify(parsed, null, 2), 'utf8');
                    await interaction.reply({ content: `✅ Trusted ${selectedIds.length} user(s).`, ephemeral: true });
                } else if (interaction.customId === 'voice_select_untrust') {
                    if (!mapping || mapping.ownerId !== member.id) return await interaction.reply({ content: '<:fail:1444451615255040061> You are not the owner of this channel.', ephemeral: true });
                    mapping.trustedUsers = mapping.trustedUsers || [];
                    const selectedIds = interaction.values;
                    mapping.trustedUsers = mapping.trustedUsers.filter(id => !selectedIds.includes(id));
                    if (parsed) fs.writeFileSync(path.join(__dirname, '..', '..', 'database', 'guild.json'), JSON.stringify(parsed, null, 2), 'utf8');
                    await interaction.reply({ content: `✅ Removed trust from ${selectedIds.length} user(s).`, ephemeral: true });
                } else if (interaction.customId === 'voice_select_block') {
                    if (!mapping || mapping.ownerId !== member.id) return await interaction.reply({ content: '<:fail:1444451615255040061> You are not the owner of this channel.', ephemeral: true });
                    mapping.blockedUsers = mapping.blockedUsers || [];
                    const selectedIds = interaction.values;
                    mapping.blockedUsers.push(...selectedIds);
                    if (parsed) fs.writeFileSync(path.join(__dirname, '..', '..', 'database', 'guild.json'), JSON.stringify(parsed, null, 2), 'utf8');
                    await interaction.reply({ content: `✅ Blocked ${selectedIds.length} user(s).`, ephemeral: true });
                } else if (interaction.customId === 'voice_select_unblock') {
                    if (!mapping || mapping.ownerId !== member.id) return await interaction.reply({ content: '<:fail:1444451615255040061> You are not the owner of this channel.', ephemeral: true });
                    mapping.blockedUsers = mapping.blockedUsers || [];
                    const selectedIds = interaction.values;
                    mapping.blockedUsers = mapping.blockedUsers.filter(id => !selectedIds.includes(id));
                    if (parsed) fs.writeFileSync(path.join(__dirname, '..', '..', 'database', 'guild.json'), JSON.stringify(parsed, null, 2), 'utf8');
                    await interaction.reply({ content: `✅ Unblocked ${selectedIds.length} user(s).`, ephemeral: true });
                }
            } catch (err) {
                console.error('Select menu handler error:', err);
                try { await interaction.reply({ content: '<:fail:1444451615255040061> An error occurred while processing your selection.', ephemeral: true }); } catch (e) { }
            }
        }

        if (interaction.customId.startsWith('leaderboard_')) {
            try {
                await interaction.deferUpdate();

                const parts = interaction.customId.split('_');
                const action = parts[1];
                const currentPage = parseInt(parts[2]);
                const sort = parts[3];
                const displayMode = parts[4] || 'roblox';
                const originalUserId = parts[5];
                if (interaction.user.id !== originalUserId) {
                    try {
                        await interaction.reply({
                            content: '❌ Only the original user can control this leaderboard.\n> Please use </leaderboard:1436827056015937728> to create your own leaderboard.',
                            ephemeral: true
                        });
                    } catch (e) {
                        console.error('Failed to reply to unauthorized user:', e);
                    }
                    return;
                }

                const lastInteraction = leaderboardSessionTimestamps.get(originalUserId) || interaction.message.createdTimestamp;
                const now = Date.now();
                const timeDiff = now - lastInteraction;
                const fiveMinutes = 5 * 60 * 1000;

                if (timeDiff > fiveMinutes) {
                    const disabled = leaderboardModule.createButtons(
                        parseInt(currentPage),
                        1,
                        sort,
                        displayMode,
                        originalUserId,
                        true
                    );
                    try {
                        await interaction.message.edit({
                            content: '⏰ Session expired. Please use </leaderboard:1436827056015937728> again.',
                            components: [disabled],
                            embeds: []
                        });
                    } catch (e) {
                        console.error('Failed to edit expired session:', e);
                    }
                    return;
                }
                leaderboardSessionTimestamps.set(originalUserId, now);

                try {
                    const sessionScheduler = require('../../utils/disableButton/sessionScheduler');
                    if (sessionScheduler && typeof sessionScheduler.clearTimeoutOnly === 'function') {
                        try {
                            sessionScheduler.clearTimeoutOnly(interaction.message.id);
                        } catch (e) {
                            sessionScheduler.clearTimeoutOnly(originalUserId);
                        }
                    }
                } catch (err) {
                    console.error('Failed to clear leaderboard disable timeout:', err);
                }

                let users;
                const currentTime = Date.now();
                if (cachedUsers && (currentTime - cacheTime) < CACHE_DURATION) {
                    users = cachedUsers;
                } else {
                    users = await leaderboardModule.getUsersWithAge();
                    cachedUsers = users;
                    cacheTime = currentTime;
                }
                if (sort === 'old') users.sort((a, b) => a.createdDate - b.createdDate);
                else if (sort === 'new') users.sort((a, b) => b.createdDate - a.createdDate);
                else users.sort((a, b) => (a.roblox_nickname || a.roblox_username).localeCompare(b.roblox_nickname || b.roblox_username));

                const totalPages = Math.ceil(users.length / 10);
                let page = parseInt(currentPage);
                let newDisplay = displayMode;

                if (action === 'prev' && page > 1) page--;
                else if (action === 'next' && page < totalPages) page++;
                else if (action === 'toggle') newDisplay = displayMode === 'roblox' ? 'discord' : 'roblox';

                const guildName = interaction.guild ? interaction.guild.name : 'Unknown';
                const allUsers = leaderboardModule.loadDatabase();
                const currentUser = allUsers.find(u => u.userid === interaction.user.id);
                const currentUserWithAge = users.find(u => u.userid === currentUser?.userid);

                const embed = leaderboardModule.createLeaderboardEmbed(users, page, sort, totalPages, newDisplay, guildName, currentUserWithAge, Date.now());
                const buttons = leaderboardModule.createButtons(page, totalPages, sort, newDisplay, originalUserId);

                try {
                    await interaction.message.edit({
                        embeds: [embed],
                        components: [buttons]
                    });
                } catch (e) {
                    console.error('Failed to edit leaderboard:', e);
                }

                try {
                    const sessionScheduler = require('../../utils/disableButton/sessionScheduler');
                    if (sessionScheduler && typeof sessionScheduler.schedule === 'function') {
                        sessionScheduler.schedule({
                            key: interaction.message.id,
                            channelId: interaction.channelId,
                            messageId: interaction.message.id,
                            type: 'leaderboard',
                            meta: {
                                originalUserId,
                                page,
                                totalPages,
                                sort,
                                displayMode: newDisplay
                            },
                            expiresAt: Date.now() + 5 * 60 * 1000
                        });
                    }
                } catch (err) {
                    console.error('Failed to schedule leaderboard disable:', err);
                }
            } catch (e) {
                console.error('Leaderboard interaction error:', e);
            }
        }
    }
};