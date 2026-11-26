// Export de la vidéo : node render.cjs [--page promo-v2.html] [--stills t1,t2,...] [--out fichier.mp4]
// Chaque image est rendue de façon déterministe (window.render(t)), puis encodée par ffmpeg.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const FPS = 30;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const pageFile = opt("--page") || "index.html";
  await page.goto("file://" + path.join(__dirname, pageFile));
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  await page.waitForTimeout(500);
  const stills = opt("--stills");
  if (stills) {
    const dir = opt("--dir") || ".";
    for (const t of stills.split(",").map(Number)) {
      await page.evaluate((t) => window.render(t), t);
      await page.screenshot({ path: path.join(dir, `still-${t.toFixed(2)}.jpg`), type: "jpeg", quality: 85 });
    }
    await browser.close();
    return;
  }
  const out = opt("--out") || path.join(__dirname, "digital-pass-promo.mp4");
  const duration = await page.evaluate(() => window.DURATION);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const total = Math.round(duration * FPS);
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 150 === 0) console.log(`image ${i}/${total}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  console.log("vidéo :", out);
})();
