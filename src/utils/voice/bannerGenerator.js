const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

class VoiceButtonBannerGenerator {
    constructor() {
        this.buttonTemplates = {
            // Row 1 - Top buttons (NAME, LIMIT, PRIVACY, WAITING ROOM, CHAT)
            'voice_btn_rename': { 
                emoji: '📝', 
                label: 'NAME', 
                color: '#5865F2',
                bgColor: '#1E1F29'
            },
            'voice_btn_limit': { 
                emoji: '👥', 
                label: 'LIMIT', 
                color: '#EB459E',
                bgColor: '#1E1F29'
            },
            'voice_btn_privacy': { 
                emoji: '🔒', 
                label: 'PRIVACY', 
                color: '#57F287',
                bgColor: '#1E1F29'
            },
            'voice_btn_waiting': { 
                emoji: '⏳', 
                label: 'WAITING R.', 
                color: '#FEE75C',
                bgColor: '#1E1F29'
            },
            'voice_btn_chat': { 
                emoji: '💬', 
                label: 'CHAT', 
                color: '#9B59B6',
                bgColor: '#1E1F29'
            },

            // Row 2 - Middle buttons (TRUST, UNTRUST, INVITE, KICK, REGION)
            'voice_btn_trust': { 
                emoji: '✅', 
                label: 'TRUST', 
                color: '#57F287',
                bgColor: '#1E1F29'
            },
            'voice_btn_untrust': { 
                emoji: '❌', 
                label: 'UNTRUST', 
                color: '#ED4245',
                bgColor: '#1E1F29'
            },
            'voice_btn_invite': { 
                emoji: '📨', 
                label: 'INVITE', 
                color: '#5865F2',
                bgColor: '#1E1F29'
            },
            'voice_btn_kick': { 
                emoji: '👢', 
                label: 'KICK', 
                color: '#ED4245',
                bgColor: '#1E1F29'
            },
            'voice_btn_region': { 
                emoji: '🌐', 
                label: 'REGION', 
                color: '#3498DB',
                bgColor: '#1E1F29'
            },

            // Row 3 - Bottom buttons (BLOCK, UNBLOCK, CLAIM, TRANSFER, DELETE)
            'voice_btn_block': { 
                emoji: '🚫', 
                label: 'BLOCK', 
                color: '#ED4245',
                bgColor: '#1E1F29'
            },
            'voice_btn_unblock': { 
                emoji: '🔓', 
                label: 'UNBLOCK', 
                color: '#57F287',
                bgColor: '#1E1F29'
            },
            'voice_btn_claim': { 
                emoji: '👑', 
                label: 'CLAIM', 
                color: '#FEE75C',
                bgColor: '#1E1F29'
            },
            'voice_btn_transfer': { 
                emoji: '🔄', 
                label: 'TRANSFER', 
                color: '#9B59B6',
                bgColor: '#1E1F29'
            },
            'voice_btn_delete': { 
                emoji: '🗑️', 
                label: 'DELETE', 
                color: '#E74C3C',
                bgColor: '#1E1F29'
            }
        };
    }

    // 🎨 Generate banner dengan design mirip gambar
    async generateVoiceControlBanner() {
        const width = 1000;
        const height = 380;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background gradient gelap
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#0D0E12');
        gradient.addColorStop(0.5, '#13141A');
        gradient.addColorStop(1, '#0D0E12');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Header dengan garis dekoratif
        ctx.fillStyle = '#5865F2';
        ctx.fillRect(0, 0, width, 4);

        // Title utama
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 32px "Arial"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('VOICE CHANNEL CONTROL PANEL', width / 2, 20);

        // Subtitle
        ctx.fillStyle = '#B9BBBE';
        ctx.font = '16px "Arial"';
        ctx.fillText('Manage your temporary voice channel with advanced controls', width / 2, 60);

        // Define rows sesuai gambar
        const rows = [
            // Row 1: NAME, LIMIT, PRIVACY, WAITING R., CHAT
            [
                'voice_btn_rename',
                'voice_btn_limit',
                'voice_btn_privacy', 
                'voice_btn_waiting',
                'voice_btn_chat'
            ],
            // Row 2: TRUST, UNTRUST, INVITE, KICK, REGION
            [
                'voice_btn_trust',
                'voice_btn_untrust',
                'voice_btn_invite',
                'voice_btn_kick',
                'voice_btn_region'
            ],
            // Row 3: BLOCK, UNBLOCK, CLAIM, TRANSFER, DELETE
            [
                'voice_btn_block',
                'voice_btn_unblock', 
                'voice_btn_claim',
                'voice_btn_transfer',
                'voice_btn_delete'
            ]
        ];

        // Draw buttons untuk setiap row
        const startY = 100;
        const buttonWidth = 180;
        const buttonHeight = 65;
        const buttonSpacing = 15;
        const borderRadius = 12;

        rows.forEach((row, rowIndex) => {
            const totalButtons = row.length;
            const totalWidth = (totalButtons * buttonWidth) + ((totalButtons - 1) * buttonSpacing);
            let currentX = Math.round((width - totalWidth) / 2);
            const currentY = startY + (rowIndex * (buttonHeight + 20));

            row.forEach(buttonId => {
                const template = this.buttonTemplates[buttonId];
                if (!template) {
                    currentX += buttonWidth + buttonSpacing;
                    return;
                }

                this.drawModernButton(ctx, currentX, currentY, buttonWidth, buttonHeight, template, borderRadius);
                currentX += buttonWidth + buttonSpacing;
            });
        });

        // Footer dengan informasi
        ctx.fillStyle = '#72767D';
        ctx.font = '12px "Arial"';
        ctx.textAlign = 'center';
        ctx.fillText('• Use these controls to manage your temporary voice channel •', width / 2, height - 25);

        return canvas.toBuffer();
    }

    // 🎯 Draw modern button dengan design mirip gambar
    drawModernButton(ctx, x, y, width, height, template, radius) {
        // Button background dengan shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        
        ctx.fillStyle = template.bgColor || '#1E1F29';
        this.drawRoundedRect(ctx, x, y, width, height, radius);
        ctx.fill();
        
        ctx.restore();

        // Border glow effect
        ctx.strokeStyle = template.color + '40';
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, x, y, width, height, radius);
        ctx.stroke();

        // Icon circle dengan gradient
        const iconSize = 28;
        const iconX = x + 20;
        const iconY = y + (height / 2) - 5;

        // Circle background
        ctx.fillStyle = template.color + '20';
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Icon/emoji
        ctx.fillStyle = template.color;
        ctx.font = `18px "Arial"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(template.emoji, iconX, iconY);

        // Label text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px "Arial"';
        ctx.textAlign = 'left';
        
        const textX = iconX + iconSize + 10;
        const textY = iconY;
        
        ctx.fillText(template.label, textX, textY);

        // Subtitle/description kecil
        ctx.fillStyle = '#B9BBBE';
        ctx.font = '10px "Arial"';
        
        // Tambahkan deskripsi berdasarkan button type
        let description = '';
        switch(template.label) {
            case 'NAME': description = 'Change name'; break;
            case 'LIMIT': description = 'Set user limit'; break;
            case 'PRIVACY': description = 'Toggle privacy'; break;
            case 'WAITING R.': description = 'Waiting room'; break;
            case 'CHAT': description = 'Text channel'; break;
            case 'TRUST': description = 'Add to trusted'; break;
            case 'UNTRUST': description = 'Remove trust'; break;
            case 'INVITE': description = 'Invite users'; break;
            case 'KICK': description = 'Kick user'; break;
            case 'REGION': description = 'Change region'; break;
            case 'BLOCK': description = 'Block user'; break;
            case 'UNBLOCK': description = 'Unblock user'; break;
            case 'CLAIM': description = 'Claim ownership'; break;
            case 'TRANSFER': description = 'Transfer owner'; break;
            case 'DELETE': description = 'Delete channel'; break;
        }
        
        ctx.fillText(description, textX, textY + 15);
    }

    // 🔧 Utility function untuk rounded rectangle
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // 🖼️ Generate compact version untuk embed kecil
    async generateCompactBanner() {
        const width = 240;
        const height = 120;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0D0E12';
        ctx.fillRect(0, 0, width, height);

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px "Arial"';
        ctx.textAlign = 'center';
        ctx.fillText('VOICE CONTROL PANEL', width / 2, 25);

        // Define compact rows
        const compactRows = [
            ['voice_btn_rename', 'voice_btn_limit', 'voice_btn_privacy', 'voice_btn_region'],
            ['voice_btn_invite', 'voice_btn_kick', 'voice_btn_claim', 'voice_btn_transfer']
        ];

        // Draw compact buttons
        const startY = 60;
        const buttonWidth = 180;
        const buttonHeight = 50;
        const buttonSpacing = 15;

        compactRows.forEach((row, rowIndex) => {
            const totalButtons = row.length;
            const totalWidth = (totalButtons * buttonWidth) + ((totalButtons - 1) * buttonSpacing);
            let currentX = Math.round((width - totalWidth) / 2);
            const currentY = startY + (rowIndex * (buttonHeight + 15));

            row.forEach(buttonId => {
                const template = this.buttonTemplates[buttonId];
                if (!template) {
                    currentX += buttonWidth + buttonSpacing;
                    return;
                }

                this.drawCompactButton(ctx, currentX, currentY, buttonWidth, buttonHeight, template, 8);
                currentX += buttonWidth + buttonSpacing;
            });
        });

        return canvas.toBuffer();
    }

    // 🎯 Draw compact button
    drawCompactButton(ctx, x, y, width, height, template, radius) {
        // Button background
        ctx.fillStyle = template.bgColor || '#1E1F29';
        this.drawRoundedRect(ctx, x, y, width, height, radius);
        ctx.fill();

        // Border
        ctx.strokeStyle = template.color + '40';
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, x, y, width, height, radius);
        ctx.stroke();

        // Icon
        const iconX = x + 15;
        const iconY = y + (height / 2);

        ctx.fillStyle = template.color;
        ctx.font = `16px "Arial"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(template.emoji, iconX, iconY);

        // Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px "Arial"';
        ctx.textAlign = 'left';
        ctx.fillText(template.label, iconX + 25, iconY);
    }
}

module.exports = new VoiceButtonBannerGenerator();