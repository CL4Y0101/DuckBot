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
                    .setTitle('🔍 Your Roblox Verification Status')
                    .setDescription(`**Discord:** ${interaction.user.username}\n**Roblox Username:** ${existingUser.roblox_username}\n**Roblox Display Name:** ${existingUser.roblox_nickname || 'Not fetched yet'}\n**Verified:** ${existingUser.verified ? '✅ Yes' : '❌ No'}`)
                    .setAuthor({
                        name: interaction.user.username,
                        iconURL: interaction.user.displayAvatarURL({
                            dynamic: true
                        }),
                        url: robloxProfileUrl
                    })
                    .setColor(existingUser.verified ? '#393a41' : '#393a41')
                    .setTimestamp();

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
                    .setPlaceholder('Example: luhnox')
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(robloxInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }
        }

        if (interaction.customId === 'reverify_button') {
            const modal = new ModalBuilder()
                .setCustomId('reverify_modal')
                .setTitle('Reverify Your Username');

            const robloxInput = new TextInputBuilder()
                .setCustomId('roblox_username')
                .setLabel('Masukkan username Roblox kamu:')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Example: luhnox')
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(robloxInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('leaderboard_')) {
            const parts = interaction.customId.split('_');
            const action = parts[1];
            const currentPage = parseInt(parts[2]);
            const sort = parts[3];
            const displayMode = parts[4] || 'roblox';

            const {
                loadDatabase,
                getUsersWithAge,
                createLeaderboardEmbed,
                createButtons
            } = leaderboardModule;

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
            
            const userDatabase = loadDatabase();
            users.forEach(user => {
                const dbUser = userDatabase.find(u => u.userid === user.userid);
                if (dbUser) {
                    user.discord_username = dbUser.username;
                }
            });

            if (sort === 'old') {
                users.sort((a, b) => a.createdDate - b.createdDate);
            } else if (sort === 'new') {
                users.sort((a, b) => b.createdDate - a.createdDate);
            } else {
                users.sort((a, b) => (a.roblox_nickname || a.roblox_username).localeCompare(b.roblox_nickname || b.roblox_username));
            }

            const totalPages = Math.ceil(users.length / 10);
            const embed = createLeaderboardEmbed(users, newPage, sort, totalPages, newDisplayMode);
            const buttons = createButtons(newPage, totalPages, sort, newDisplayMode);

            await interaction.update({
                embeds: [embed],
                components: [buttons]
            });
        }
    }
};