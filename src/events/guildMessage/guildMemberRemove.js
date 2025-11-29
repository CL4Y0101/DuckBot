const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const GIFEncoder = require('gifencoder');
const fs = require('fs');
const path = require('path');
const inviteTracker = require('../../utils/inviteTracker');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        try {
            if (member.user.bot) return;

            const channelId = '985908885938376744';
            const channel = client.channels.cache.get(channelId) || member.guild.channels.cache.get(channelId);

            if (!channel) {
                console.log('Channel not found');
                return;
            }

            const leaveBanner = await createAnimatedLeaveBanner(member);

            const leaveEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`\`😢\` Goodbye from ${member.guild.name}!`)
                .setDescription(`**${member.user.username}** has left the server.\n\nWe're sad to see you go! 😔`)
                .addFields(
                    { name: '\`📅\` Joined Server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
                    { name: '\`👥\` Members Left', value: `#${member.guild.memberCount}`, inline: true },
                    { name: '\`📝\` Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setImage('attachment://leave_banner.gif')
                .setThumbnail(member.user.displayAvatarURL({ format: 'png', size: 128 }))
                .setTimestamp();

            await channel.send({
                content: `😢 ${member.user.username} has left the server...`,
                embeds: [leaveEmbed],
                files: [leaveBanner]
            });

            try {
                await inviteTracker.trackMemberLeave(client, member);
            } catch (err) {
                console.error('❌ Error while running inviteTracker.trackMemberLeave:', err);
            }

        } catch (error) {
            console.error('❌ Error sending leave message:', error);

            const channelId = '985908885938376744';
            const channel = member.guild.channels.cache.get(channelId);
            if (channel) {
                await channel.send(`😢 ${member.user.username} has left the server. We'll miss you!`);
            }
        }
    },
};

async function createAnimatedLeaveBanner(member) {
    return new Promise(async (resolve, reject) => {
        try {
            const bannerPath = path.join(__dirname, '../../assets/img/banner_discord.gif');

            if (!fs.existsSync(bannerPath)) {
                const simpleBanner = await createSimpleBanner(member, 'goodbye');
                return resolve(simpleBanner);
            }

            const width = 800;
            const height = 300;

            const encoder = new GIFEncoder(width, height);
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(150);
            encoder.setQuality(5);

            let avatarImage;
            try {
                const avatarUrl = member.user.displayAvatarURL({
                    extension: 'jpg',
                    size: 128,
                    forceStatic: true
                });
                avatarImage = await loadImage(avatarUrl);
            } catch (error) {
                console.log('❌ Error loading avatar:', error.message);
                avatarImage = null;
            }

            try {
                const backgroundImage = await loadImage(bannerPath);

                const totalFrames = 8;

                for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                    ctx.clearRect(0, 0, width, height);

                    ctx.drawImage(backgroundImage, 0, 0, width, height);

                    const overlayAlpha = 0.5 + Math.sin(frameIndex * 0.5) * 0.1;
                    ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
                    ctx.fillRect(0, 0, width, height);

                    if (avatarImage) {
                        ctx.save();

                        const borderAlpha = 0.6 + Math.sin(frameIndex * 0.7) * 0.2;
                        ctx.strokeStyle = `rgba(255, 255, 255, ${borderAlpha})`;
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.arc(150, 150, 58, 0, Math.PI * 2);
                        ctx.stroke();

                        ctx.globalAlpha = 0.8;
                        ctx.beginPath();
                        ctx.arc(150, 150, 56, 0, Math.PI * 2);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(avatarImage, 94, 94, 112, 112);
                        ctx.restore();
                        ctx.globalAlpha = 1.0;
                    }

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 32px Arial';
                    ctx.textAlign = 'center';

                    ctx.fillText('😢 GOODBYE 😢', 550, 100);

                    ctx.font = 'bold 24px Arial';
                    const username = member.user.username.length > 12
                        ? member.user.username.substring(0, 12) + '...'
                        : member.user.username;
                    ctx.fillText(username, 550, 140);

                    ctx.font = '20px Arial';
                    const serverName = member.guild.name.length > 15
                        ? member.guild.name.substring(0, 15) + '...'
                        : member.guild.name;
                    ctx.fillText(`from ${serverName}`, 550, 170);

                    ctx.font = 'bold 18px Arial';
                    ctx.fillText(`Members Left: ${member.guild.memberCount}`, 550, 200);

                    encoder.addFrame(ctx);
                }

                encoder.finish();

                const gifBuffer = encoder.out.getData();

                const attachment = new AttachmentBuilder(gifBuffer, { name: 'leave_banner.gif' });

                resolve(attachment);

            } catch (error) {
                console.log('❌ Error in GIF processing:', error.message);
                const simpleBanner = await createSimpleBanner(member, 'goodbye');
                resolve(simpleBanner);
            }

        } catch (error) {
            console.error('❌ Error creating animated leave banner:', error.message);
            const simpleBanner = await createSimpleBanner(member, 'goodbye');
            resolve(simpleBanner);
        }
    });
}

async function createSimpleBanner(member, type) {
    const canvas = createCanvas(600, 200);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 600, 200);
    if (type === 'leave') {
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
    } else {
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(1, '#ee5a24');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 200);

    try {
        const avatarUrl = member.user.displayAvatarURL({
            extension: 'jpg',
            size: 64,
            forceStatic: true
        });
        const avatar = await loadImage(avatarUrl);

        ctx.save();
        ctx.beginPath();
        ctx.arc(80, 100, 30, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 50, 70, 60, 60);
        ctx.restore();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(80, 100, 32, 0, Math.PI * 2);
        ctx.stroke();
    } catch (error) {
        console.log('❌ Error loading avatar for simple banner:', error.message);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';

    const title = type === 'goodbye' ? 'WELCOME' : 'GOODBYE';
    ctx.fillText(title, 150, 60);

    ctx.font = 'bold 20px Arial';
    const username = member.user.username.length > 10
        ? member.user.username.substring(0, 10) + '...'
        : member.user.username;
    ctx.fillText(username, 150, 90);

    ctx.font = '16px Arial';
    const serverText = type === 'leave' ? `to ${member.guild.name}` : `from ${member.guild.name}`;
    const serverName = member.guild.name.length > 15
        ? member.guild.name.substring(0, 15) + '...'
        : member.guild.name;
    ctx.fillText(serverText, 150, 115);

    ctx.font = 'bold 14px Arial';
    const memberText = type === 'leave'
        ? `Member #${member.guild.memberCount}`
        : `Members: ${member.guild.memberCount}`;
    ctx.fillText(memberText, 150, 140);

    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, {
        name: type === 'leave' ? 'leave_banner.png' : 'leave_banner.png'
    });

    return attachment;
}