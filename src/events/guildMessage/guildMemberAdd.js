const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const GIFEncoder = require('gifencoder');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            if (member.user.bot) return;

            const channelId = '985908716496896051';
            const channel = member.guild.channels.cache.get(channelId);

            if (!channel) {
                console.log('Channel not found');
                return;
            }

            const welcomeBanner = await createAnimatedWelcomeBanner(member);

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`🎉 Welcome to ${member.guild.name}!`)
                .setDescription(`Hello ${member.user.username}! Welcome to our server!\n\nWe're glad to have you here! 🥳`)
                .addFields(
                    { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '👥 Member Count', value: `#${member.guild.memberCount}`, inline: true },
                    { name: '📝 Server Rules', value: 'Please read the rules channel!', inline: true }
                )
                .setImage('attachment://welcome_banner.gif')
                .setThumbnail(member.user.displayAvatarURL({ format: 'png', size: 128 }))
                .setTimestamp();

            await channel.send({
                embeds: [welcomeEmbed],
                files: [welcomeBanner]
            });

            console.log(`Welcome message sent for ${member.user.tag}`);
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    },
};

async function createAnimatedWelcomeBanner(member) {
    return new Promise(async (resolve, reject) => {
        try {
            const bannerPath = path.join(__dirname, '../../assets/img/banner_discord.gif');
            
            if (!fs.existsSync(bannerPath)) {
                console.log('Background GIF not found, using animated gradient');
                const fallbackBanner = await createFallbackAnimatedBanner(member, 'welcome');
                return resolve(fallbackBanner);
            }

            const width = 800;
            const height = 300;
            
            const encoder = new GIFEncoder(width, height);
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(100);
            encoder.setQuality(10);

            let baseBackground;
            try {
                baseBackground = await loadImage(bannerPath);
            } catch (error) {
                console.log('Error loading background GIF:', error);
                const fallbackBanner = await createFallbackAnimatedBanner(member, 'welcome');
                return resolve(fallbackBanner);
            }

            let avatarImage;
            try {
                const avatarUrl = member.user.displayAvatarURL({ 
                    extension: 'png', 
                    size: 256,
                    forceStatic: true 
                });
                avatarImage = await loadImage(avatarUrl);
            } catch (error) {
                console.log('Error loading avatar:', error);
                avatarImage = null;
            }

            for (let frame = 0; frame < 12; frame++) {
                ctx.clearRect(0, 0, width, height);

                ctx.drawImage(baseBackground, 0, 0, width, height);

                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(0, 0, width, height);

                if (avatarImage) {
                    ctx.save();
                    
                    const borderSize = 4 + Math.sin(frame * 0.8) * 2;
                    ctx.strokeStyle = `hsl(${(frame * 30) % 360}, 100%, 65%)`;
                    ctx.lineWidth = borderSize;
                    ctx.beginPath();
                    ctx.arc(150, 150, 62, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(150, 150, 60, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    
                    ctx.drawImage(avatarImage, 90, 90, 120, 120);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(150, 150, 60, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 40px Arial';
                ctx.textAlign = 'center';
                
                const bounceOffset = Math.sin(frame * 0.7) * 8;
                ctx.fillText('🎉 WELCOME 🎉', 550, 100 + bounceOffset);

                ctx.font = 'bold 32px Arial';
                const username = member.user.username.length > 15 
                    ? member.user.username.substring(0, 15) + '...' 
                    : member.user.username;
                
                ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
                ctx.shadowBlur = 10;
                ctx.fillText(username, 550, 150);
                ctx.shadowBlur = 0;

                ctx.font = '28px Arial';
                const serverName = member.guild.name.length > 20
                    ? member.guild.name.substring(0, 20) + '...'
                    : member.guild.name;
                ctx.fillText(`to ${serverName}`, 550, 190);

                ctx.font = 'bold 24px Arial';
                const scale = 1 + Math.sin(frame * 0.5) * 0.1;
                ctx.save();
                ctx.translate(550, 230);
                ctx.scale(scale, scale);
                ctx.fillText(`Member #${member.guild.memberCount}`, 0, 0);
                ctx.restore();

                ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(frame * 0.5) * 0.2})`;
                for (let i = 0; i < 3; i++) {
                    const x = 500 + Math.cos(frame * 0.3 + i) * 20;
                    const y = 250 + Math.sin(frame * 0.3 + i) * 10;
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                encoder.addFrame(ctx);
            }

            encoder.finish();
            const gifBuffer = encoder.out.getData();
            const attachment = new AttachmentBuilder(gifBuffer, { name: 'welcome_banner.gif' });

            resolve(attachment);

        } catch (error) {
            console.error('Error creating animated welcome banner:', error);
            const staticBanner = await createStaticWelcomeBanner(member);
            resolve(staticBanner);
        }
    });
}

async function createFallbackAnimatedBanner(member, type) {
    const width = 800;
    const height = 300;
    
    const encoder = new GIFEncoder(width, height);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(100);
    encoder.setQuality(10);

    let avatarImage;
    try {
        const avatarUrl = member.user.displayAvatarURL({ 
            extension: 'png', 
            size: 256,
            forceStatic: true 
        });
        avatarImage = await loadImage(avatarUrl);
    } catch (error) {
        console.log('Error loading avatar:', error);
        avatarImage = null;
    }

    for (let frame = 0; frame < 10; frame++) {
        ctx.clearRect(0, 0, width, height);

        const hue = (frame * 15) % 360;
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, `hsl(${hue}, 80%, 60%)`);
        gradient.addColorStop(1, `hsl(${(hue + 120) % 360}, 80%, 60%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        if (avatarImage) {
            ctx.save();
            ctx.strokeStyle = `hsl(${(frame * 20) % 360}, 100%, 50%)`;
            ctx.lineWidth = 4 + Math.sin(frame * 0.8) * 2;
            ctx.beginPath();
            ctx.arc(150, 150, 62, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(150, 150, 60, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImage, 90, 90, 120, 120);
            ctx.restore();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        
        const title = type === 'welcome' ? '🎉 WELCOME 🎉' : '😢 GOODBYE 😢';
        const bounceOffset = Math.sin(frame * 0.7) * 8;
        ctx.fillText(title, 550, 100 + bounceOffset);

        ctx.font = 'bold 28px Arial';
        const username = member.user.username.length > 15 
            ? member.user.username.substring(0, 15) + '...' 
            : member.user.username;
        ctx.fillText(username, 550, 150);

        ctx.font = '24px Arial';
        const serverText = type === 'welcome' ? `to ${member.guild.name}` : `from ${member.guild.name}`;
        const serverName = member.guild.name.length > 20
            ? member.guild.name.substring(0, 20) + '...'
            : member.guild.name;
        ctx.fillText(serverText, 550, 190);

        ctx.font = '20px Arial';
        const memberText = type === 'welcome' 
            ? `Member #${member.guild.memberCount}` 
            : `Members Left: ${member.guild.memberCount}`;
        ctx.fillText(memberText, 550, 230);

        encoder.addFrame(ctx);
    }

    encoder.finish();
    const gifBuffer = encoder.out.getData();
    return new AttachmentBuilder(gifBuffer, { name: `${type}_banner.gif` });
}

async function createStaticWelcomeBanner(member) {
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext('2d');

    const bannerPath = path.join(__dirname, '../../assets/img/banner_discord.gif');
    if (fs.existsSync(bannerPath)) {
        try {
            const background = await loadImage(bannerPath);
            ctx.drawImage(background, 0, 0, 800, 300);
        } catch (error) {
            console.log('Error loading static background:', error);
            const gradient = ctx.createLinearGradient(0, 0, 800, 300);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 800, 300);
        }
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, 800, 300);

    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 150, 60, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    try {
        const avatarUrl = member.user.displayAvatarURL({ 
            extension: 'png', 
            size: 256,
            forceStatic: true 
        });
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, 90, 90, 120, 120);
    } catch (error) {
        console.log('Error loading avatar:', error);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(90, 90, 120, 120);
    }
    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(150, 150, 62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('WELCOME', 550, 100);

    ctx.font = 'bold 28px Arial';
    const username = member.user.username.length > 15 
        ? member.user.username.substring(0, 15) + '...' 
        : member.user.username;
    ctx.fillText(username, 550, 150);

    ctx.font = '24px Arial';
    const serverName = member.guild.name.length > 20
        ? member.guild.name.substring(0, 20) + '...'
        : member.guild.name;
    ctx.fillText(`to ${serverName}`, 550, 190);

    ctx.font = '20px Arial';
    ctx.fillText(`Member #${member.guild.memberCount}`, 550, 230);

    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'welcome_banner.png' });

    return attachment;
}