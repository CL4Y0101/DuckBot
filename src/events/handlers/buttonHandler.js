const {
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
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
        if (!interaction.isButton()) return;

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

        if (interaction.customId === 'voice_set_active') {
            try {
                const member = interaction.member;
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    await interaction.reply({ content: '❌ You need Administrator to set the active voice channel.', ephemeral: true });
                    return;
                }

                const voiceChannel = member.voice.channel;
                if (!voiceChannel) {
                    await interaction.reply({ content: '❌ You must be connected to a voice channel to set it as active.', ephemeral: true });
                    return;
                }

                const guildConfigPath = path.join(__dirname, '..', '..', 'database', 'guild.json');
                let raw = '[]';
                try { raw = fs.existsSync(guildConfigPath) ? fs.readFileSync(guildConfigPath, 'utf8') : '[]'; } catch { }
                let parsed = [];
                try { parsed = raw.trim() ? JSON.parse(raw) : []; } catch (e) { parsed = []; }

                const gid = interaction.guild.id;
                let modified = false;
                if (Array.isArray(parsed)) {
                    let foundIdx = -1;
                    for (let i = 0; i < parsed.length; i++) {
                        const item = parsed[i];
                        if (item && typeof item === 'object' && item[gid]) { foundIdx = i; break; }
                    }
                    if (foundIdx === -1) {
                        const newCfg = {};
                        newCfg[gid] = { voice: {} };
                        newCfg[gid].voice.lobby = voiceChannel.id;
                        parsed.push(newCfg);
                        modified = true;
                    } else {
                        const cfg = parsed[foundIdx][gid] = parsed[foundIdx][gid] || {};
                        cfg.voice = cfg.voice || {};
                        cfg.voice.lobby = voiceChannel.id;
                        modified = true;
                    }
                } else if (parsed && typeof parsed === 'object') {
                    parsed[gid] = parsed[gid] || {};
                    parsed[gid].voice = parsed[gid].voice || {};
                    parsed[gid].voice.lobby = voiceChannel.id;
                    modified = true;
                }

                if (modified) {
                    try { fs.writeFileSync(guildConfigPath, JSON.stringify(parsed, null, 2)); console.log(`💾 Updated guild.json voice.lobby for ${gid} -> ${voiceChannel.id}`); } catch (e) { console.error('❌ Failed to write guild.json', e); }
                }

                try {
                    const embed = new EmbedBuilder()
                        .setTitle('Temporary Voice Setup')
                        .setDescription(`Gunakan tombol di bawah untuk menetapkan voice channel aktif sebagai lobby.\n\nCurrent lobby: <#${voiceChannel.id}>`)
                        .setColor('#5865F2');

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('voice_set_active').setLabel('Set Active Voice').setStyle(ButtonStyle.Primary)
                    );

                    try { await interaction.update({ embeds: [embed], components: [row] }); } catch (e) { /* message may be ephemeral */ }
                } catch (e) {
                    console.error('Failed to update voice setup message:', e);
                }

                await interaction.reply({ content: `✅ Voice lobby set to ${voiceChannel.name}`, ephemeral: true });
            } catch (err) {
                console.error('Error handling voice_set_active button:', err);
                try { await interaction.reply({ content: '❌ Error setting voice lobby', ephemeral: true }); } catch (e) { }
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