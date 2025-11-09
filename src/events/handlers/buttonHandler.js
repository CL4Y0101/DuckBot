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
const fs = require('fs');
const path = require('path');

const databasePath = path.join(__dirname, '../../database/username.json');

const leaderboardModule = require('../../commands/profile/leaderboard');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'verify_button') {
            let data = [];
            if (fs.existsSync(databasePath)) {
                const fileContent = fs.readFileSync(databasePath, 'utf8');
                if (fileContent.trim()) {
                    data = JSON.parse(fileContent);
                }
            }

            const existingUser = data.find(u => u.userid === interaction.user.id);

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

        if (interaction.customId === 'reverify_button') {
            const modal = new ModalBuilder()
                .setCustomId('verify_modal')
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

        const leaderboardSessionTimestamps = new Map();

        if (interaction.customId.startsWith('leaderboard_')) {
            const parts = interaction.customId.split('_');
            const action = parts[1];
            const currentPage = parseInt(parts[2]);
            const sort = parts[3];
            const displayMode = parts[4] || 'roblox';
            const originalUserId = parts[5];

            if (interaction.user.id !== originalUserId) {
                return await interaction.reply({
                    content: '❌ Only the user who initiated this leaderboard can interact with these buttons.\n> -# Please use the </leaderboard:1436827056015937728> command to start your own session.',
                    ephemeral: true
                });
            }

            const lastInteraction = leaderboardSessionTimestamps.get(originalUserId) || interaction.message.createdTimestamp;
            const now = Date.now();
            const timeDiff = now - lastInteraction;
            const fiveMinutes = 5 * 60 * 1000;

            const {
                loadDatabase,
                getUsersWithAge,
                createLeaderboardEmbed,
                createButtons
            } = leaderboardModule;

            if (timeDiff > fiveMinutes) {
                const users = await getUsersWithAge();
                const totalPages = Math.ceil(users.length / 10);
                const guildName = interaction.guild ? interaction.guild.name : 'Unknown Guild';
                const allUsers = loadDatabase();
                const currentUser = allUsers.find(u => u.userid === interaction.user.id);
                const currentUserWithAge = users.find(u => u.userid === currentUser?.userid);

                const embed = createLeaderboardEmbed(users, currentPage, sort, totalPages, displayMode, guildName, currentUserWithAge);
                const disabledButtons = createButtons(currentPage, totalPages, sort, displayMode, originalUserId, true);

                await interaction.update({
                    embeds: [embed],
                    components: [disabledButtons]
                });

                leaderboardSessionTimestamps.delete(originalUserId);
                return;
            }

            leaderboardSessionTimestamps.set(originalUserId, now);

            let newPage = currentPage;
            let newDisplayMode = displayMode;

            if (action === 'prev' && currentPage > 1) {
                newPage = currentPage - 1;
            } else if (action === 'next') {
                newPage = currentPage + 1;
            } else if (action === 'toggle') {
                newDisplayMode = displayMode === 'roblox' ? 'discord' : 'roblox';
            }

            const users = await getUsersWithAge();
            if (sort === 'old') {
                users.sort((a, b) => a.createdDate - b.createdDate);
            } else if (sort === 'new') {
                users.sort((a, b) => b.createdDate - a.createdDate);
            } else {
                users.sort((a, b) => (a.roblox_nickname || a.roblox_username).localeCompare(b.roblox_nickname || b.roblox_username));
            }

            const totalPages = Math.ceil(users.length / 10);
            const guildName = interaction.guild ? interaction.guild.name : 'Unknown Guild';
            const allUsers = loadDatabase();
            const currentUser = allUsers.find(u => u.userid === interaction.user.id);
            const currentUserWithAge = users.find(u => u.userid === currentUser?.userid);

            const embed = createLeaderboardEmbed(users, newPage, sort, totalPages, newDisplayMode, guildName, currentUserWithAge);
            const buttons = createButtons(newPage, totalPages, sort, newDisplayMode, originalUserId);

            await interaction.update({
                embeds: [embed],
                components: [buttons]
            });
        }
    }
};