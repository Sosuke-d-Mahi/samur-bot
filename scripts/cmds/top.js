const { createCanvas, loadImage, registerFont } = require("canvas");
const path = require("path");

// Register Bangla + English fonts
registerFont(path.join(__dirname, "../cmds/assets/font/HindSiliguri-Bold.ttf"), { family: "HindSiliguri" });
registerFont(path.join(__dirname, "../cmds/assets/font/Arial-Bold.ttf"), { family: "ArialBold" });

async function generateLeaderboardImage(topUsers) {
  const width = 1200;
  const height = 1400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // ----- Background -----
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#0f2027");
  gradient.addColorStop(0.5, "#203a43");
  gradient.addColorStop(1, "#2c5364");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add overlay glow
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ----- Title -----
  ctx.font = "bold 80px ArialBold";
  const titleGradient = ctx.createLinearGradient(0, 0, width, 0);
  titleGradient.addColorStop(0, "#ff6a00");
  titleGradient.addColorStop(1, "#ee0979");
  ctx.fillStyle = titleGradient;
  ctx.shadowColor = "#ff6a00";
  ctx.shadowBlur = 25;
  ctx.textAlign = "center";
  ctx.fillText("🏆 TOP LEADERBOARD 🏆", width / 2, 110);

  ctx.shadowBlur = 0; // reset

  // ----- Cards -----
  const startY = 200;
  const cardHeight = 85;
  const gap = 25;

  for (let i = 0; i < topUsers.length; i++) {
    const user = topUsers[i];
    const y = startY + i * (cardHeight + gap);

    // Card background
    const cardX = 120;
    const cardWidth = width - 240;
    const radius = 20;

    const cardGradient = ctx.createLinearGradient(cardX, y, cardX + cardWidth, y + cardHeight);
    cardGradient.addColorStop(0, "rgba(255,255,255,0.12)");
    cardGradient.addColorStop(1, "rgba(255,255,255,0.06)");

    ctx.fillStyle = cardGradient;
    ctx.beginPath();
    ctx.moveTo(cardX + radius, y);
    ctx.lineTo(cardX + cardWidth - radius, y);
    ctx.quadraticCurveTo(cardX + cardWidth, y, cardX + cardWidth, y + radius);
    ctx.lineTo(cardX + cardWidth, y + cardHeight - radius);
    ctx.quadraticCurveTo(cardX + cardWidth, y + cardHeight, cardX + cardWidth - radius, y + cardHeight);
    ctx.lineTo(cardX + radius, y + cardHeight);
    ctx.quadraticCurveTo(cardX, y + cardHeight, cardX, y + cardHeight - radius);
    ctx.lineTo(cardX, y + radius);
    ctx.quadraticCurveTo(cardX, y, cardX + radius, y);
    ctx.fill();

    // Rank number
    ctx.font = "bold 40px HindSiliguri";
    ctx.fillStyle = "#FFD700";
    ctx.shadowColor = "#FFD700";
    ctx.shadowBlur = 8;
    ctx.fillText(`#${i + 1}`, 150, y + 55);
    ctx.shadowBlur = 0;

    // Avatar
    if (user.avatar) {
      try {
        const img = await loadImage(user.avatar);
        const imgX = 200, imgY = y + 5, imgSize = 75;
        ctx.save();
        ctx.beginPath();
        ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
        ctx.restore();
      } catch {}
    }

    // User name
    ctx.font = "bold 36px HindSiliguri";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 8;
    ctx.fillText(user.name || "Unknown", 320, y + 55);
    ctx.shadowBlur = 0;

    // Total money (with glow)
    ctx.font = "bold 34px ArialBold";
    const moneyText = `${user.total.toLocaleString()} 💰`;
    const textWidth = ctx.measureText(moneyText).width;
    const textX = width - 180 - textWidth;
    ctx.fillStyle = "#00ffb3";
    ctx.shadowColor = "#00ffb3";
    ctx.shadowBlur = 12;
    ctx.fillText(moneyText, textX, y + 55);
    ctx.shadowBlur = 0;
  }

  // Footer
  ctx.font = "28px HindSiliguri";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "center";
  ctx.fillText("Updated in real-time | Powered by SIMO²", width / 2, height - 40);

  return canvas.toBuffer();
}