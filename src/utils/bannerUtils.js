const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function createWelcomeBanner(member, bannerPath) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(bannerPath)) {
        console.log('Banner GIF not found, creating static banner');
        const staticBanner = await createStaticWelcomeBanner(member);
        return resolve(staticBanner);
      }

      const gifBuffer = fs.readFileSync(bannerPath);
      const attachment = new AttachmentBuilder(gifBuffer, { name: 'banner_discord.gif' });
      resolve(attachment);

    } catch (error) {
      console.error('Error creating welcome banner:', error);
      const staticBanner = await createStaticWelcomeBanner(member);
      resolve(staticBanner);
    }
  });
}

async function createLeaveBanner(member, bannerPath) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(bannerPath)) {
        console.log('Banner GIF not found, creating static banner');
        const staticBanner = await createStaticLeaveBanner(member);
        return resolve(staticBanner);
      }

      const gifBuffer = fs.readFileSync(bannerPath);
      const attachment = new AttachmentBuilder(gifBuffer, { name: 'banner_discord.gif' });
      resolve(attachment);

    } catch (error) {
      console.error('Error creating leave banner:', error);
      const staticBanner = await createStaticLeaveBanner(member);
      resolve(staticBanner);
    }
  });
}

async function createStaticWelcomeBanner(member) {
  const canvas = createCanvas(800, 300);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 800, 300);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
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
  ctx.fillText('WELCOME', 280, 120);

  ctx.font = 'bold 28px Arial';
  ctx.fillText(member.user.username, 280, 160);

  ctx.font = '24px Arial';
  ctx.fillText(`to ${member.guild.name}`, 280, 200);

  ctx.font = '20px Arial';
  ctx.fillText(`Member #${member.guild.memberCount}`, 280, 240);

  const buffer = canvas.toBuffer('image/png');
  const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });

  return attachment;
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

module.exports = {
  createWelcomeBanner,
  createLeaveBanner,
  createStaticWelcomeBanner,
  createStaticLeaveBanner
};
