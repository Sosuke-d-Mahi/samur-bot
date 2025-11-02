const os = require('os');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const si = require('systeminformation');

function sanitizePercentage(value, defaultVal = 0) {
    const num = parseFloat(value);
    if (isNaN(num)) return defaultVal;
    return Math.max(0, Math.min(100, num));
}

function formatUptime(seconds, short = false) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (short) return `${d}d`;
    return `${d}d ${h}h ${m}m ${s}s`;
}

function getCurrentCPUUsage() {
    return new Promise((resolve) => {
        const startCores = os.cpus();
        setTimeout(() => {
            const endCores = os.cpus();
            let totalIdle = 0;
            let totalTick = 0;

            for (let i = 0; i < endCores.length; i++) {
                const start = startCores[i].times;
                const end = endCores[i].times;
                totalTick += (end.user - start.user) + (end.nice - start.nice) + (end.sys - start.sys) + (end.irq - start.irq) + (end.idle - start.idle);
                totalIdle += (end.idle - start.idle);
            }
            const usage = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0;
            resolve(Math.max(0, Math.min(100, usage)).toFixed(2));
        }, 100);
    });
}

async function getPrimaryDiskUsage() {
    try {
        const data = await si.fsSize();
        const primaryDisk = data.find(d => d.mount === '/' || d.fs.toLowerCase().startsWith('c:')) || data[0];
        if (primaryDisk) {
            return {
                use: primaryDisk.use,
                total: (primaryDisk.size / 1024 / 1024 / 1024).toFixed(1),
                used: (primaryDisk.used / 1024 / 1024 / 1024).toFixed(1)
            };
        }
    } catch (e) {
        console.error("Failed to get disk usage with systeminformation:", e);
    }
    return { use: 0, total: '0', used: '0' };
}

function drawRoundRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle = null, lineWidth = 1) {
    if (width <= 0 || height <= 0) return;
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

function drawLinearProgressBar(ctx, x, y, width, height, progressPercentage, barColor, bgColor, label, valueText, font, textColor) {
    if (width <= 0 || height <= 0) return;
    const sanitizedProgress = sanitizePercentage(progressPercentage);

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, width, height);

    const progressWidth = (width * sanitizedProgress) / 100;
    if (progressWidth > 0) {
        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, progressWidth, height);
    }

    ctx.fillStyle = textColor;
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - height - 2);

    ctx.textAlign = 'right';
    ctx.fillText(valueText, x + width, y - height - 2);
    ctx.textAlign = 'left';
}

function drawStatCircle(ctx, x, y, radius, mainText, subText, mainColor, subColor, circleColor, bgColor) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = circleColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = mainColor;
    ctx.font = `bold ${radius * 0.35}px Arial, Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mainText, x, y - radius * 0.2);

    ctx.fillStyle = subColor;
    ctx.font = `${radius * 0.22}px Arial, Sans-Serif`;
    ctx.fillText(subText, x, y + radius * 0.4);
}

module.exports = {
    config: {
        name: 'uptime',
        aliases: ['upt'],
        version: '4.3',
        author: 'Mahi--',
        countDown: 15,
        role: 0,
        shortDescription: 'Display system stats as an image.',
        longDescription: {
            id: 'Displays bot uptime and system statistics in an image format, styled like the reference image.',
            en: 'Displays bot uptime and system statistics in an image format, styled like the reference image.'
        },
        category: 'system',
        guide: {
            id: '{pn}: Generates and shows an image with system statistics.',
            en: '{pn}: Generates and shows an image with system statistics.'
        }
    },

    onStart: async function ({ message }) {
        try {
            const botUptimeSeconds = process.uptime();
            const systemUptimeSeconds = os.uptime();
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            let osMemoryUsagePercentageNum = (usedMemory / totalMemory) * 100;
            let currentCpuUsageNum = parseFloat(await getCurrentCPUUsage());

            const cpuCores = os.cpus().length;
            const platformInfo = os.platform();
            const arch = os.arch();
            const hostnameOriginal = os.hostname();
            const hostname = hostnameOriginal.length > 20 ? hostnameOriginal.substring(0, 17) + "..." : hostnameOriginal;

            const processMemUsage = process.memoryUsage();
            const processMemMB = (processMemUsage.rss / 1024 / 1024).toFixed(1);

            const diskInfo = await getPrimaryDiskUsage();
            let diskUsagePercentageNum = diskInfo.use;

            osMemoryUsagePercentageNum = sanitizePercentage(osMemoryUsagePercentageNum);
            currentCpuUsageNum = sanitizePercentage(currentCpuUsageNum);
            diskUsagePercentageNum = sanitizePercentage(diskUsagePercentageNum);

            const canvasWidth = 1000;
            const canvasHeight = 667;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            const defaultFontFamily = 'Arial, Sans-Serif';
            const bgUrl = 'https://i.ibb.co/WvVFyLTs/image.jpg';

            try {
                const bgImage = await loadImage(bgUrl);
                ctx.drawImage(bgImage, 0, 0, canvasWidth, canvasHeight);
            } catch (imgError) {
                console.error("Failed to load background image, using dark fallback:", imgError);
                ctx.fillStyle = '#030C29';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            }

            const panelFillColor = '#000000B0';
            const panelStrokeColor = '#60A5FA88';
            const textColorPrimary = '#E5E7EB';
            const textColorSecondary = '#9CA3AF';
            const accentRed = '#F7546C';
            const accentPurple = '#A78BFA';
            const accentBlue = '#3B82F6';
            const progressBarBG = '#3A3D5288';
            const circleBG = '#00000099';

            const now = new Date();
            const dateString = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
            ctx.fillStyle = textColorPrimary;
            ctx.font = `bold 32px ${defaultFontFamily}`;
            ctx.textAlign = 'left';
            ctx.fillText("HomoHost", 30, 45);

            ctx.fillStyle = textColorSecondary;
            ctx.font = `14px ${defaultFontFamily}`;
            ctx.textAlign = 'right';
            ctx.fillText(dateString, canvasWidth - 30, 35);
            ctx.fillText(`Homettook, Flncs`, canvasWidth - 30, 55);
            ctx.textAlign = 'left';

            const panelGap = 20;
            const panelY = 80;
            const panelHeight = canvasHeight - 110;
            const totalPanelWidth = canvasWidth - panelGap * 3;
            const panelWidth = totalPanelWidth / 2;
            const panelRadius = 15;

            const leftPanelX = panelGap;
            const rightPanelX = leftPanelX + panelWidth + panelGap;

            drawRoundRect(ctx, leftPanelX, panelY, panelWidth, panelHeight, panelRadius, panelFillColor, panelStrokeColor, 2);
            drawRoundRect(ctx, rightPanelX, panelY, panelWidth, panelHeight, panelRadius, panelFillColor, panelStrokeColor, 2);

            let currentY = panelY + 40;
            const leftMargin = leftPanelX + 30;
            const leftBarWidth = panelWidth - 60;
            const barHeight = 5;
            const lineSpacing = 60;
            const infoLineSpacing = 28;
            const barFont = `14px ${defaultFontFamily}`;
            const infoFont = `16px ${defaultFontFamily}`;

            ctx.fillStyle = textColorPrimary;
            ctx.font = `bold 20px ${defaultFontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText("System Status Overview", leftPanelX + panelWidth / 2, currentY);
            currentY += 60;
            ctx.textAlign = 'left';

            drawLinearProgressBar(ctx, leftMargin, currentY, leftBarWidth, barHeight, currentCpuUsageNum, accentRed, progressBarBG, "CPU Usage", `${currentCpuUsageNum.toFixed(1)}%`, barFont, textColorPrimary);
            currentY += lineSpacing;
            drawLinearProgressBar(ctx, leftMargin, currentY, leftBarWidth, barHeight, osMemoryUsagePercentageNum, accentPurple, progressBarBG, "Memory Usage", `${osMemoryUsagePercentageNum.toFixed(1)}%`, barFont, textColorPrimary);
            currentY += lineSpacing;
            drawLinearProgressBar(ctx, leftMargin, currentY, leftBarWidth, barHeight, diskUsagePercentageNum, accentBlue, progressBarBG, "Disk Usage", `${diskUsagePercentageNum}%`, barFont, textColorPrimary);
            currentY += lineSpacing * 1.3;

            ctx.font = infoFont;
            const textLeftMargin = leftMargin + 10;
            const textRightMargin = leftPanelX + panelWidth - 30;

            const infoItems = [
                { label: "Bot Uptime:", value: formatUptime(botUptimeSeconds) },
                { label: "System Uptime:", value: formatUptime(systemUptimeSeconds) },
                { label: "Platform:", value: `${platformInfo} (${arch})` },
                { label: "CPU Cores:", value: `${cpuCores}` },
                { label: "Total RAM:", value: `${(totalMemory / (1024 ** 3)).toFixed(2)} GB` },
                { label: "Total Disk:", value: `${diskInfo.total} GB` },
                { label: "Hostname:", value: hostname }
            ];

            infoItems.forEach(item => {
                ctx.fillStyle = textColorSecondary;
                ctx.textAlign = 'left';
                ctx.fillText(item.label, textLeftMargin, currentY);
                ctx.fillStyle = textColorPrimary;
                ctx.textAlign = 'right';
                ctx.fillText(item.value, textRightMargin, currentY);
                currentY += infoLineSpacing;
            });

            ctx.fillStyle = textColorPrimary;
            ctx.font = `bold 20px ${defaultFontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText("Resource Monitor", rightPanelX + panelWidth / 2, panelY + 40);

            const buttonRadius = 35;
            const gridCols = 3;
            const gridRows = 4;
            const buttonPanelWidth = panelWidth - 40;
            const buttonStartX = rightPanelX + 20;
            const buttonStartY = panelY + 80;

            const colWidth = buttonPanelWidth / gridCols;
            const rowHeight = (panelHeight - 100) / gridRows;

            const statsData = [
                { label: "CPU", value: `${currentCpuUsageNum.toFixed(1)}%`, color: accentRed },
                { label: "RAM", value: `${osMemoryUsagePercentageNum.toFixed(1)}%`, color: accentPurple },
                { label: "DISK", value: `${diskUsagePercentageNum}%`, color: accentBlue },
                { label: "BOT UP", value: formatUptime(botUptimeSeconds, true), color: textColorSecondary },
                { label: "SYS UP", value: formatUptime(systemUptimeSeconds, true), color: textColorSecondary },
                { label: "CORES", value: `${cpuCores}`, color: textColorSecondary },
                { label: "PROC MEM", value: `${processMemMB}MB`, color: accentPurple },
                { label: "TOTAL MEM", value: `${(totalMemory / (1024 ** 3)).toFixed(1)}GB`, color: accentPurple },
                { label: "PLATFORM", value: platformInfo, color: textColorSecondary },
                { label: "ARCH", value: arch, color: textColorSecondary },
                { label: "TOTAL DISK", value: `${diskInfo.total}GB`, color: accentBlue },
                { label: "USED DISK", value: `${diskInfo.used}GB`, color: accentBlue }
            ];

             for (let row = 0; row < gridRows; row++) {
                for (let col = 0; col < gridCols; col++) {
                    const index = row * gridCols + col;
                    if (index < statsData.length) {
                        const centerX = buttonStartX + col * colWidth + colWidth / 2;
                        const centerY = buttonStartY + row * rowHeight + rowHeight / 2;
                        const data = statsData[index];
                        drawStatCircle(ctx, centerX, centerY, buttonRadius, data.value, data.label, data.color, textColorSecondary, data.color, circleBG);
                    }
                }
            }


            const imgPath = path.join(__dirname, "cache", `system_image_v4.3_${Date.now()}.png`);
            await fs.ensureDir(path.dirname(imgPath));
            const buffer = canvas.toBuffer("image/png");
            fs.writeFileSync(imgPath, buffer);

            return message.reply({ attachment: fs.createReadStream(imgPath) }, () => {
                fs.unlink(imgPath, (err) => {
                    if (err) console.error("Failed to delete temp image:", err);
                });
            });

        } catch (err) {
            console.error(`Error generating system image:`, err);
            return message.reply(`❌ Could not generate the system dashboard image due to an internal error. Please check console logs.`);
        }
    }
};
