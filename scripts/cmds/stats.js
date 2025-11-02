const { createCanvas, registerFont } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const disk = require('diskusage-ng');

function sanitizePercentage(value, defaultVal = 0) {
    const num = parseFloat(value);
    if (isNaN(num)) return defaultVal;
    return Math.max(0, Math.min(100, num));
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
}

function drawFormattedUptime(ctx, text, x, y, numFont, unitFont, numColor, unitColor) {
    const parts = text.match(/(\d+)([dhm])/g) || [];
    let currentX = x;
    ctx.textBaseline = 'alphabetic';
    parts.forEach((part) => {
        const num = part.match(/\d+/)[0];
        const unit = part.match(/[dhm]/)[0];
        ctx.font = numFont;
        ctx.fillStyle = numColor;
        ctx.fillText(num, currentX, y);
        currentX += ctx.measureText(num).width + 2;
        ctx.font = unitFont;
        ctx.fillStyle = unitColor;
        ctx.textBaseline = 'bottom';
        ctx.fillText(unit, currentX, y);
        currentX += ctx.measureText(unit).width + 10;
        ctx.textBaseline = 'alphabetic';
    });
}

function getCurrentCPUUsage() {
    return new Promise((resolve) => {
        const startCores = os.cpus();
        setTimeout(() => {
            const endCores = os.cpus();
            let totalIdle = 0, totalTick = 0;
            for (let i = 0; i < endCores.length; i++) {
                const start = startCores[i].times;
                const end = endCores[i].times;
                totalTick += (end.user - start.user) + (end.nice - start.nice) + (end.sys - start.sys) + (end.irq - start.irq) + (end.idle - start.idle);
                totalIdle += (end.idle - start.idle);
            }
            const usage = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0;
            resolve(Math.max(0, Math.min(100, usage)));
        }, 100);
    });
}

function drawRoundRect(ctx, x, y, width, height, radius) {
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
    ctx.fill();
}

function drawCircularProgressBar(ctx, x, y, radius, lineWidth, progress, color, bgColor) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (progress / 100) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = bgColor;
    ctx.lineWidth = lineWidth + 2;
    ctx.stroke();
    if (progress > 0) {
        ctx.beginPath();
        ctx.arc(x, y, radius, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

module.exports = {
    config: {
        name: 'stats',
        aliases: ['dashboard'],
        version: '5.1_PERFECTED',
        author: 'Mahi--',
        countDown: 10,
        role: 0,
        shortDescription: 'Display a clean system dashboard.',
        category: 'system',
        guide: { en: '{pn}' }
    },

    onStart: async function ({ message }) {
        try {
            const botUptimeSeconds = process.uptime();
            const systemUptimeSeconds = os.uptime();
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const osMemoryUsagePercentageNum = sanitizePercentage((usedMemory / totalMemory) * 100);
            const currentCpuUsageNum = await getCurrentCPUUsage();

            const cpus = os.cpus();
            const cpuModel = cpus[0].model.trim();
            const cpuCores = cpus.length;
            const platformInfo = os.platform();
            const arch = os.arch();
            const hostname = os.hostname();
            const loadAvg = os.loadavg().map(avg => avg.toFixed(2)).join(', ');

            const processMemUsage = process.memoryUsage().rss;
            const processMemMB = (processMemUsage / 1024 / 1024).toFixed(2);
            const processMemPercentageOfTotal = ((processMemUsage / totalMemory) * 100);
            const processId = process.pid;

            let diskUsagePercentageNum = 0;
            try {
                const diskPath = platformInfo === 'win32' ? 'c:' : '/';
                const dUsage = await disk.diskUsage(diskPath);
                if (dUsage && dUsage.total > 0) {
                    diskUsagePercentageNum = (dUsage.used / dUsage.total) * 100;
                }
            } catch (e) { console.error("Failed to get disk usage:", e); }

            const canvas = createCanvas(1200, 838);
            const ctx = canvas.getContext('2d');
            const defaultFont = "Arial";

            const bgColor = '#1D2639';
            const panelColor = '#273449';
            const textColor = '#FFFFFF';
            const secondaryTextColor = '#8A9CB1';
            const accentGreen = '#4ADE80';
            const accentRed = '#F87171';
            const accentPurple = '#A78BFA';
            const accentBlue = '#60A5FA';

            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = textColor;
            ctx.font = `bold 26px ${defaultFont}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText("Anchestor", 40, 45);

            const now = new Date();
            const dateString = `${now.getDate()} ${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`;
            ctx.fillStyle = secondaryTextColor;
            ctx.font = `15px ${defaultFont}`;
            ctx.textAlign = 'right';
            ctx.fillText(dateString, canvas.width - 40, 35);
            ctx.fillText(`Anchestor • ${platformInfo}`, canvas.width - 40, 55);
            
            const p = 40; const g = 20; const panelW = (canvas.width - p*2 - g*3) / 4; const panelH = 120;
            const topY = 90;
            
            const topPanels = [
                { x: p, label: "Bot Uptime", value: formatUptime(botUptimeSeconds), prog: (botUptimeSeconds % 86400) / 864, color: accentGreen },
                { x: p + panelW + g, label: "System Uptime", value: formatUptime(systemUptimeSeconds), prog: 100, color: accentGreen },
                { x: p + (panelW+g)*2, label: "CPU Usage", value: `${currentCpuUsageNum.toFixed(2)}%`, prog: currentCpuUsageNum, color: accentRed },
                { x: p + (panelW+g)*3, label: "Memory Usage", value: `${osMemoryUsagePercentageNum.toFixed(2)}%`, prog: osMemoryUsagePercentageNum, color: accentPurple }
            ];

            topPanels.forEach(panel => {
                ctx.fillStyle = panelColor;
                drawRoundRect(ctx, panel.x, topY, panelW, panelH, 15);
                ctx.fillStyle = secondaryTextColor;
                ctx.font = `16px ${defaultFont}`;
                ctx.textAlign = 'left';
                ctx.fillText(panel.label, panel.x + 25, topY + 30);
                if(panel.label.includes("Uptime")) {
                    drawFormattedUptime(ctx, panel.value, panel.x + 25, topY + 80, `bold 40px ${defaultFont}`, `bold 20px ${defaultFont}`, textColor, secondaryTextColor);
                } else {
                    ctx.fillStyle = textColor;
                    ctx.font = `bold 48px ${defaultFont}`;
                    ctx.fillText(panel.value, panel.x + 25, topY + 85);
                }
                ctx.fillStyle = '#1D2639';
                ctx.fillRect(panel.x + 25, topY + panelH - 25, panelW - 50, 4);
                ctx.fillStyle = panel.color;
                ctx.fillRect(panel.x + 25, topY + panelH - 25, (panelW - 50) * (panel.prog / 100), 4);
            });

            const midY = topY + panelH + g;
            const midH = 280;
            const graphW = canvas.width * 0.58 - p - g/2;
            const circleW = canvas.width - graphW - p*2 - g;
            
            ctx.fillStyle = panelColor;
            drawRoundRect(ctx, p, midY, graphW, midH, 15);
            ctx.fillStyle = secondaryTextColor;
            ctx.font = `18px ${defaultFont}`;
            ctx.textAlign = 'left';
            ctx.fillText("Server Uptime", p + 25, midY + 35);
            
            const graphPad = {x: 55, y: 60}, chartH = midH - 95, chartW = graphW - 80;
            const graphPoints = [98, 99, 99.5, 98.5, 99, 100, 99];
            for(let i=0; i<=4; i++) {
                ctx.strokeStyle = '#4A556844';
                ctx.lineWidth = 1;
                ctx.beginPath();
                const y = midY + graphPad.y + (chartH * (i/4));
                ctx.moveTo(p + graphPad.x, y);
                ctx.lineTo(p + graphPad.x + chartW, y);
                ctx.stroke();
                ctx.fillStyle = secondaryTextColor;
                ctx.font = `12px ${defaultFont}`;
                ctx.textAlign = 'right';
                ctx.fillText(`${100 - i*25}%`, p + graphPad.x - 10, y + 4);
            }
            const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            for (let i = 0; i < 7; i++) {
                ctx.textAlign = 'center';
                const x = p + graphPad.x + (chartW / 6) * i;
                ctx.fillText(days[i], x, midY + graphPad.y + chartH + 20);
            }
            const graphGradient = ctx.createLinearGradient(0, midY, 0, midY + midH);
            graphGradient.addColorStop(0, accentGreen + '99');
            graphGradient.addColorStop(1, accentGreen + '00');
            ctx.fillStyle = graphGradient;
            ctx.beginPath();
            ctx.moveTo(p + graphPad.x, midY + graphPad.y + chartH);
            for(let i=0; i<7; i++) {
                const x = p + graphPad.x + (chartW / 6) * i;
                const y = midY + graphPad.y + chartH - (graphPoints[i] / 100) * chartH;
                ctx.lineTo(x,y);
            }
            ctx.lineTo(p + graphPad.x + chartW, midY + graphPad.y + chartH);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = accentGreen;
            ctx.lineWidth = 3;
            ctx.beginPath();
            for(let i=0; i<7; i++) {
                const x = p + graphPad.x + (chartW / 6) * i;
                const y = midY + graphPad.y + chartH - (graphPoints[i] / 100) * chartH;
                if(i === 0) ctx.moveTo(x,y);
                else ctx.lineTo(x,y);
                ctx.beginPath();
                ctx.arc(x,y, 4, 0, Math.PI*2);
                ctx.fillStyle = accentGreen;
                ctx.fill();
            }
            ctx.stroke();

            const circleX = p + graphW + g;
            ctx.fillStyle = panelColor;
            drawRoundRect(ctx, circleX, midY, circleW, midH, 15);
            ctx.fillStyle = secondaryTextColor;
            ctx.font = `18px ${defaultFont}`;
            ctx.fillText("Resource Usage", circleX + 25, midY + 35);
            
            const circleData = [
                { label: "CPU", value: currentCpuUsageNum, color: accentRed },
                { label: "Memory", value: osMemoryUsagePercentageNum, color: accentPurple },
                { label: "Disk", value: diskUsagePercentageNum, color: accentBlue }
            ];
            const cRadius = 55, cLw = 10, cGap = (circleW - (cRadius*2*3)) / 4;
            circleData.forEach((circ, i) => {
                const cx = circleX + cGap * (i+1) + cRadius + (cRadius*2*i);
                const cy = midY + midH / 2 + 20;
                drawCircularProgressBar(ctx, cx, cy, cRadius, cLw, circ.value, circ.color, '#1D2639');
                ctx.font = `bold 28px ${defaultFont}`;
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                ctx.fillText(`${circ.value.toFixed(1)}%`, cx, cy - 5);
                ctx.font = `16px ${defaultFont}`;
                ctx.fillStyle = secondaryTextColor;
                ctx.fillText(circ.label, cx, cy + 20);
            });
            
            const botY = midY + midH + g;
            const botH = canvas.height - botY - p;
            const sysInfoW = (canvas.width - p*2 - g) / 2;
            const procStatW = sysInfoW;
            
            ctx.fillStyle = panelColor;
            drawRoundRect(ctx, p, botY, sysInfoW, botH, 15);
            ctx.fillStyle = secondaryTextColor;
            ctx.font = `18px ${defaultFont}`;
            ctx.textAlign = 'left';
            ctx.fillText("System Information", p + 25, botY + 35);

            const sysInfoData = [
                { label: "Platform", value: `${platformInfo} (x64)` },
                { label: "CPU Model", value: cpuModel },
                { label: "CPU Cores", value: `${cpuCores} cores` },
                { label: "Total Ram", value: `${(totalMemory / (1024 ** 3)).toFixed(2)} GB` },
                { label: "Hostname", value: hostname },
                { label: "Load Average", value: loadAvg }
            ];
            let sysInfoY = botY + 75;
            const labelX = p + 25;
            const valueX = p + 160;
            sysInfoData.forEach(item => {
                ctx.font = `16px ${defaultFont}`;
                ctx.textAlign = 'left';
                ctx.fillStyle = secondaryTextColor;
                ctx.fillText(item.label, labelX, sysInfoY);
                ctx.fillStyle = textColor;
                ctx.fillText(item.value.length > 35 ? item.value.substring(0,32)+'...' : item.value, valueX, sysInfoY);
                sysInfoY += 35;
            });
            
            const procStatX = p + sysInfoW + g;
            ctx.fillStyle = panelColor;
            drawRoundRect(ctx, procStatX, botY, procStatW, botH, 15);
            ctx.fillStyle = secondaryTextColor;
            ctx.font = `18px ${defaultFont}`;
            ctx.textAlign = 'left';
            ctx.fillText("Process Statistics", procStatX + 25, botY + 35);

            let procY = botY + 75;
            ctx.font = `16px ${defaultFont}`;
            ctx.fillStyle = textColor;
            ctx.fillText("Process Memory Usage", procStatX + 25, procY);
            ctx.textAlign = 'right';
            ctx.fillText(`${processMemMB} MB`, procStatX + procStatW - 25, procY);
            procY += 25;
            ctx.fillStyle = accentGreen;
            ctx.font = `bold 14px ${defaultFont}`;
            ctx.fillText(`${processMemPercentageOfTotal.toFixed(2)}% of total RAM`, procStatX + procStatW - 25, procY);
            procY += 10;
            const procBarW = procStatW - 50;
            ctx.fillStyle = '#1D2639';
            ctx.fillRect(procStatX + 25, procY, procBarW, 6);
            ctx.fillStyle = accentGreen;
            ctx.fillRect(procStatX + 25, procY, procBarW * (processMemPercentageOfTotal / 100), 6);
            procY += 40;

            const procData = [
                { label: "Process Uptime", value: formatUptime(botUptimeSeconds) },
                { label: "Process ID", value: processId },
                { label: "Platform", value: process.platform }
            ];
            procData.forEach(item => {
                ctx.fillStyle = secondaryTextColor;
                ctx.textAlign = 'left';
                ctx.font = `16px ${defaultFont}`;
                ctx.fillText(item.label, procStatX + 25, procY);
                ctx.fillStyle = textColor;
                ctx.textAlign = 'right';
                ctx.fillText(item.value, procStatX + procStatW - 25, procY);
                procY += 35;
            });

            ctx.font = `12px ${defaultFont}`;
            ctx.fillStyle = secondaryTextColor;
            ctx.textAlign = 'center';
            ctx.fillText(`System Dashboard v1.0 • Generated ${dateString} at ${now.toLocaleTimeString()}`, canvas.width/2, canvas.height - 15);

            const imgPath = path.join(__dirname, "cache", `dashboard.png`);
            await fs.ensureDir(path.dirname(imgPath));
            fs.writeFileSync(imgPath, canvas.toBuffer("image/png"));
            
            return message.reply({ attachment: fs.createReadStream(imgPath) }, () => fs.unlinkSync(imgPath));

        } catch (err) {
            console.error("Error generating system image:", err);
            return message.reply(`❌ Could not generate the dashboard image due to an internal error.\n\nError: ${err.name}\nMessage: ${err.message}`);
        }
    }
};