const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

class VoiceButtonBannerGenerator {
    constructor() {
        this.buttonTemplates = {
            'voice_btn_bitrate': { emoji: '🔊', label: 'BITRATE', color: '#40444B' },
            'voice_btn_limit': { emoji: '👥', label: 'LIMIT', color: '#40444B' },
            'voice_btn_rename': { emoji: '📝', label: 'RENAME', color: '#40444B' },
            'voice_btn_region': { emoji: '🌐', label: 'REGION', color: '#40444B' },
            'voice_btn_kick': { emoji: '🚫', label: 'KICK', color: '#40444B' },
            'voice_btn_claim': { emoji: '👑', label: 'CLAIM', color: '#40444B' },
            'voice_btn_info': { emoji: 'ℹ️', label: 'INFO', color: '#40444B' },
            'voice_btn_transfer': { emoji: '🔄', label: 'TRANSFER', color: '#40444B' }
        };
        // map template keys to asset filenames (relative to src/assets/img)
        this.iconFiles = {
            'voice_btn_transfer': 'transfer.png',
            'voice_btn_info': 'info.png',
            'voice_btn_claim': 'claim.png',
            'voice_btn_kick': 'kick.png',
            'voice_btn_region': 'region.png',
            'voice_btn_rename': 'name.png',
            'voice_btn_limit': 'limit.png',
            'voice_btn_bitrate': 'bitrate.png'
        };
        this.imageCache = {};
    }

    // 🖼️ Generate compact version untuk embed kecil
    async generateCompactBanner() {
        const width = 640;
        const height = 140;

        // Attempt to register a bundled font for crisper text if available
        try {
            const fontPath = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Inter-Bold.ttf');
            if (fs.existsSync(fontPath)) registerFont(fontPath, { family: 'InterCustom' });
        } catch (e) {
            // ignore font registration errors
        }

        // Supersample: draw at higher resolution then downscale to reduce blur
        const scale = 2; // 2x rendering for anti-aliased downscale
        const canvasHi = createCanvas(width * scale, height * scale);
        const ctx = canvasHi.getContext('2d');

        // Rows definition (match publisher layout: 5 buttons top, 5 bottom with disables)
        const rows = [
            ['voice_btn_rename', 'voice_btn_limit', 'voice_btn_region', 'voice_btn_kick', 'voice_btn_bitrate'],
            ['voice_disable_left', 'voice_btn_claim', 'voice_btn_info', 'voice_btn_transfer', 'voice_disable_right']
        ];

        // Button geometry tuned to match mockup
        const startY = 18;
        const buttonWidth = 108;
        const buttonHeight = 44;
        const buttonSpacing = 14;
        const borderRadius = 22;

        // Preload icons for all buttons used in these rows
        const allIds = new Set(rows.flat());
        await Promise.all(Array.from(allIds).map(async id => {
            if (this.imageCache[id]) return;
            const filename = this.iconFiles[id];
            if (!filename) return;
            const p = path.join(__dirname, '..', '..', 'assets', 'img', filename);
            try {
                if (fs.existsSync(p)) {
                    this.imageCache[id] = await loadImage(p);
                }
            } catch (e) {
                // ignore load errors
            }
        }));

        const sw = (val) => Math.round(val * scale);

        // draw scaled elements onto hi-res canvas
        rows.forEach((row, rowIndex) => {
            const totalButtons = row.length;
            const totalWidth = (totalButtons * buttonWidth) + ((totalButtons - 1) * buttonSpacing);
            let currentX = Math.round((width - totalWidth) / 2);
            currentX = sw(currentX);
            const currentY = sw(startY + (rowIndex * (buttonHeight + 12)));

            row.forEach(buttonId => {
                const template = this.buttonTemplates[buttonId];

                // draw pill filled with a very dark semi-opaque color
                ctx.save();
                ctx.fillStyle = 'rgba(22,23,26,0.95)';
                this.drawRoundedRect(ctx, currentX, currentY, sw(buttonWidth), sw(buttonHeight), sw(borderRadius));
                ctx.fill();
                // subtle top highlight
                ctx.fillStyle = 'rgba(255,255,255,0.02)';
                this.drawRoundedRect(ctx, currentX, currentY, sw(buttonWidth), Math.floor(sw(buttonHeight) / 2), sw(borderRadius));
                ctx.fill();
                // border
                ctx.lineWidth = Math.max(1, 1.2 * scale);
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                this.drawRoundedRect(ctx, currentX, currentY, sw(buttonWidth), sw(buttonHeight), sw(borderRadius));
                ctx.stroke();
                ctx.restore();

                if (template) {
                    // left colored circle (filled)
                    const circleX = currentX + sw(12);
                    const circleY = currentY + Math.round(sw(buttonHeight) / 2);
                    const circleR = Math.round(sw(14));
                    ctx.beginPath();
                    ctx.fillStyle = template.color || '#40444B';
                    ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
                    ctx.fill();

                    // draw image icon if available, otherwise emoji fallback
                    const img = this.imageCache[buttonId];
                    if (img) {
                        const imgSize = Math.round(circleR * 1.8);
                        const ix = circleX - (imgSize / 2);
                        const iy = circleY - (imgSize / 2) - Math.round(scale * 1);
                        try { ctx.drawImage(img, ix, iy, imgSize, imgSize); } catch (e) { /* ignore */ }
                    } else {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = `${Math.round(16 * scale)}px "Segoe UI Emoji", "Apple Color Emoji", "Arial"`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(template.emoji, circleX, circleY - Math.round(scale * 1));
                    }

                    // label text
                    ctx.fillStyle = '#FFFFFF';
                    const fontFamily = fs.existsSync(path.join(__dirname, '..', '..', 'assets', 'fonts', 'Inter-Bold.ttf')) ? 'InterCustom' : 'Arial';
                    ctx.font = `${Math.round(700)} ${Math.round(12 * scale)}px ${fontFamily}`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    const textX = circleX + circleR + Math.round(8 * scale);
                    ctx.fillText((template.label || '').toUpperCase(), textX, circleY + Math.round(scale * 1));
                } else {
                    // disabled placeholder (dash) centered — draw filled pill slightly dimmer
                    ctx.save();
                    ctx.fillStyle = 'rgba(20,21,23,0.6)';
                    this.drawRoundedRect(ctx, currentX, currentY, sw(buttonWidth), sw(buttonHeight), sw(borderRadius));
                    ctx.fill();
                    ctx.restore();
                    ctx.fillStyle = '#9aa0a6';
                    ctx.font = `${Math.round(700)} ${Math.round(18 * scale)}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('-', currentX + Math.round(sw(buttonWidth) / 2), currentY + Math.round(sw(buttonHeight) / 2));
                }

                currentX += sw(buttonWidth + buttonSpacing);
            });
        });

        // Downscale to final size for crisper result
        const outCanvas = createCanvas(width, height);
        const outCtx = outCanvas.getContext('2d');
        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = 'high';
        outCtx.drawImage(canvasHi, 0, 0, width, height);

        return outCanvas.toBuffer();
    }

    // 🎯 Draw clean button seperti gambar
    drawCleanButton(ctx, x, y, width, height, template, radius) {
        // Button background - solid dark dengan border subtle
        ctx.fillStyle = '#2F3136';
        this.drawRoundedRect(ctx, x, y, width, height, radius);
        ctx.fill();

        // Border subtle
        ctx.strokeStyle = '#40444B';
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, x, y, width, height, radius);
        ctx.stroke();

        // Icon/emoji di kiri (center vertical)
        const iconX = x + 12;
        const iconY = y + (height / 2);

        ctx.font = `14px "Segoe UI Emoji", "Apple Color Emoji", "Arial"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(template.emoji, iconX, iconY);

        // Label text di kanan icon
        const textX = iconX + 18;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px "Arial"';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(template.label, textX, iconY);
    }

    // Utility: rounded rectangle path
    drawRoundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // Generate a high resolution 1920x1080 banner (HD)
    async generateHDBanner() {
        const width = 1920;
        const height = 1080;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Transparent background

        // Rows definition - keep two rows centered
        const rows = [
            ['voice_btn_rename', 'voice_btn_limit', 'voice_btn_region', 'voice_btn_kick', 'voice_btn_bitrate'],
            ['voice_disable_left', 'voice_btn_claim', 'voice_btn_info', 'voice_btn_transfer', 'voice_disable_right']
        ];

        // Geometry scaled for HD
        const startY = 160;
        const buttonWidth = 320;
        const buttonHeight = 160;
        const buttonSpacing = 48;
        const borderRadius = 40;

        // Preload icons used
        const allIds = new Set(rows.flat());
        await Promise.all(Array.from(allIds).map(async id => {
            if (this.imageCache[id]) return;
            const filename = this.iconFiles[id];
            if (!filename) return;
            const p = path.join(__dirname, '..', '..', 'assets', 'img', filename);
            try {
                if (fs.existsSync(p)) {
                    this.imageCache[id] = await loadImage(p);
                }
            } catch (e) {
                // ignore
            }
        }));

        rows.forEach((row, rowIndex) => {
            const totalButtons = row.length;
            const totalWidth = (totalButtons * buttonWidth) + ((totalButtons - 1) * buttonSpacing);
            let currentX = Math.round((width - totalWidth) / 2);
            const currentY = startY + (rowIndex * (buttonHeight + 28));

            row.forEach(buttonId => {
                const template = this.buttonTemplates[buttonId];

                // pill fill
                ctx.save();
                ctx.fillStyle = 'rgba(22,23,26,0.95)';
                this.drawRoundedRect(ctx, currentX, currentY, buttonWidth, buttonHeight, borderRadius);
                ctx.fill();
                // highlight
                ctx.fillStyle = 'rgba(255,255,255,0.02)';
                this.drawRoundedRect(ctx, currentX, currentY, buttonWidth, Math.floor(buttonHeight / 2), borderRadius);
                ctx.fill();
                // border
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                this.drawRoundedRect(ctx, currentX, currentY, buttonWidth, buttonHeight, borderRadius);
                ctx.stroke();
                ctx.restore();

                if (template) {
                    // left circle  
                    const circleX = currentX + 36;
                    const circleY = currentY + (buttonHeight / 2);
                    const circleR = 42;
                    ctx.beginPath();
                    ctx.fillStyle = template.color || '#40444B';
                    ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
                    ctx.fill();

                    const img = this.imageCache[buttonId];
                    if (img) {
                        const imgSize = Math.round(circleR * 1.6);
                        const ix = circleX - (imgSize / 2);
                        const iy = circleY - (imgSize / 2) - 2;
                        try { ctx.drawImage(img, ix, iy, imgSize, imgSize); } catch (e) { }
                    } else {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = `${Math.round(circleR * 0.7)}px "Segoe UI Emoji", "Apple Color Emoji", "Arial"`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(template.emoji, circleX, circleY - 2);
                    }

                    // label
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '800 28px Arial';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    const textX = circleX + circleR + 28;
                    ctx.fillText((template.label || '').toUpperCase(), textX, circleY + 2);
                } else {
                    // disabled
                    ctx.save();
                    ctx.fillStyle = 'rgba(20,21,23,0.6)';
                    this.drawRoundedRect(ctx, currentX, currentY, buttonWidth, buttonHeight, borderRadius);
                    ctx.fill();
                    ctx.restore();
                    ctx.fillStyle = '#9aa0a6';
                    ctx.font = '800 40px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('-', currentX + (buttonWidth / 2), currentY + (buttonHeight / 2));
                }

                currentX += buttonWidth + buttonSpacing;
            });
        });

        return canvas.toBuffer();
    }
}

const gen = new VoiceButtonBannerGenerator();
// backward-compatible alias
gen.generateVoiceControlBanner = gen.generateCompactBanner.bind(gen);
// HD / 1080p banner for better readability
gen.generateVoiceControlBannerHD = async function () {
    // call instance method below
    return await gen.generateHDBanner();
};
module.exports = gen;
