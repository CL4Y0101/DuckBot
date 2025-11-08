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

        if (interaction.customId.startsWith('leaderboard_')) {
            const parts = interaction.customId.split('_');
            const action = parts[1];
            const currentPage = parseInt(parts[2]);
            const sort = parts[3];
            const displayMode = parts[4] || 'roblox';

            const leaderboardModule = require('../../commands/profile/leaderboard');
            const loadDatabase = leaderboardModule.loadDatabase || (() => []);
            const robloxAPI = require('../../utils/roblox/robloxAPI');

            async function getUsersWithAge() {
                const users = loadDatabase();
                const usersWithAge = [];

                for (const user of users) {
                    if (!user.roblox_uid) continue;
                    try {
                        const profile = await robloxAPI.getUserProfile(user.roblox_uid);
                        if (profile && profile.created) {
                            const createdDate = new Date(profile.created);
                            usersWithAge.push({
                                ...user,
                                createdDate,
                                age: Date.now() - createdDate.getTime()
                            });
                        }
                    } catch (error) {
                        console.error(`Error fetching profile for ${user.roblox_username}:`, error);
                    }
                }

                return usersWithAge;
            }

            function formatAge(createdDate) {
                const ageMs = Date.now() - createdDate.getTime();
                const years = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365));
                const months = Math.floor((ageMs % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
                const days = Math.floor((ageMs % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));

                let ageText = '';
                if (years > 0) ageText = `${years}y ${months}m`;
                else if (months > 0) ageText = `${months}m ${days}d`;
                else ageText = `${days}d`;

                const timestamp = `<t:${Math.floor(createdDate.getTime() / 1000)}:F>`;
                return `${ageText} (${timestamp})`;
            }

            function createLeaderboardEmbed(users, page, sort, totalPages, displayMode = 'roblox') {
                const start = (page - 1) * 10;
                const end = start + 10;
                const pageUsers = users.slice(start, end);

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Roblox Account Age Leaderboard')
                    .setColor('#ff6b6b')
                    .setTimestamp();

                let description = `**Sorted by:** ${sort === 'old' ? 'Oldest Accounts' : sort === 'new' ? 'Newest Accounts' : 'Alphabetical (A-Z)'}\n**Page:** ${page}/${totalPages}\n\n`;

                pageUsers.forEach((user, index) => {
                    const rank = start + index + 1;
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
                    const displayName = displayMode === 'discord' ? user.username : (user.roblox_nickname || user.roblox_username);
                    description += `${medal} [${displayName}](https://www.roblox.com/users/${user.roblox_uid}/profile) - ${formatAge(user.createdDate)}\n`;
                });

                embed.setDescription(description);
                return embed;
            }

            function createButtons(page, totalPages, sort, displayMode = 'roblox') {
                const row = new ActionRowBuilder();

                const prevButton = new ButtonBuilder()
                    .setCustomId(`leaderboard_prev_${page}_${sort}_${displayMode}`)
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 1);

                const toggleButton = new ButtonBuilder()
                    .setCustomId(`leaderboard_toggle_${page}_${sort}_${displayMode}`)
                    .setLabel(displayMode === 'roblox' ? 'Show Discord Names' : 'Show Roblox Names')
                    .setStyle(ButtonStyle.Secondary);

                const nextButton = new ButtonBuilder()
                    .setCustomId(`leaderboard_next_${page}_${sort}_${displayMode}`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages);

                row.addComponents(prevButton, toggleButton, nextButton);
                return row;
            }

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
            const embed = createLeaderboardEmbed(users, newPage, sort, totalPages, newDisplayMode);
            const buttons = createButtons(newPage, totalPages, sort, newDisplayMode);

            await interaction.update({
                embeds: [embed],
                components: [buttons]
            });
        }
    },
};