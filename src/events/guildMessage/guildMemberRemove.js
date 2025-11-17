const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            if (member.user.bot) return;

            const channelId = '985908885938376744';
            const channel = member.guild.channels.cache.get(channelId);
            
            if (!channel) {
                console.log('Channel not found');
                return;
            }

            const bannerPath = path.join(__dirname, '../../assets/img/banner_discord.gif');
            const leaveBanner = await createLeaveBanner(member, bannerPath);

            const leaveEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`😢 Goodbye from ${member.guild.name}!`)
                .setDescription(`**${member.user.username}** has left the server.\n\nWe're sad to see you go! 😔`)
                .addFields(
                    { name: '📅 Joined Server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
                    { name: '👥 Members Left', value: `#${member.guild.memberCount}`, inline: true },
                    { name: '📝 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setImage('attachment://banner_discord.gif')
                .setThumbnail(member.user.displayAvatarURL({ format: 'png', size: 128 }))
                .setTimestamp();

            await channel.send({
                embeds: [leaveEmbed],
                files: [leaveBanner]
            });

            console.log(`Leave message sent for ${member.user.tag}`);
        } catch (error) {
            console.error('Error sending leave message:', error);
        }
    },
};

async function createLeaveBanner(member, bannerPath) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!fs.existsSync(bannerPath)) {
                console.log('Banner GIF not found, creating static banner');
                const staticBanner = await createStaticLeaveBanner(member);
                return resolve(staticBanner);
            }

            const baseBanner = await loadImage(bannerPath);
            const canvas = createCanvas(baseBanner.width, baseBanner.height);
            const ctx = canvas.getContext('2d');

            ctx.drawImage(baseBanner, 0, 0);

            ctx.save();
            ctx.beginPath();
            ctx.arc(150, 150, 60, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            try {
                const avatar = await loadImage(member.user.displayAvatarURL({ format: 'png', size: 128, dynamic: true }));
                ctx.drawImage(avatar, 90, 90, 120, 120);
            } catch (error) {
                console.log('Error loading avatar:', error);
            }
            ctx.restore();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(150, 150, 62, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Arial';
            ctx.fillText('GOODBYE', 280, 120);

            ctx.font = 'bold 28px Arial';
            ctx.fillText(member.user.username, 280, 160);

            ctx.font = '24px Arial';
            ctx.fillText(`from ${member.guild.name}`, 280, 200);

            ctx.font = '20px Arial';
            ctx.fillText(`Members Left: ${member.guild.memberCount}`, 280, 240);

            const buffer = canvas.toBuffer('image/gif');
            const attachment = new AttachmentBuilder(buffer, { name: 'banner_discord.gif' });
            resolve(attachment);

        } catch (error) {
            console.error('Error creating leave banner:', error);
            const staticBanner = await createStaticLeaveBanner(member);
            resolve(staticBanner);
        }
    });
}

async function createStaticLeaveBanner(member) {
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 800, 300);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(1, '#ee5a24');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 300);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 800; i += 20) {
        for (let j = 0; j < 300; j += 20) {
            ctx.fillRect(i, j, 2, 2);
        }
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 150, 60, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    try {
        const avatar = await loadImage(member.user.displayAvatarURL({ format: 'png', size: 128 }));
        ctx.drawImage(avatar, 90, 90, 120, 120);
    } catch (error) {
        console.log('Error loading avatar:', error);
    }
    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(150, 150, 62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('GOODBYE', 280, 120);

    ctx.font = 'bold 28px Arial';
    ctx.fillText(member.user.username, 280, 160);

    ctx.font = '24px Arial';
    ctx.fillText(`from ${member.guild.name}`, 280, 200);

    ctx.font = '20px Arial';
    ctx.fillText(`Members Left: ${member.guild.memberCount}`, 280, 240);

    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'leave.png' });

    return attachment;
}