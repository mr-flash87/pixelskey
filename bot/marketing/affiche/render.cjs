// Exporte l'affiche en PNG : node render.cjs [sortie.png]
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  await page.goto("file://" + path.join(__dirname, "affiche.html"));
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  const out = process.argv[2] || path.join(__dirname, "affiche-digital-pass.png");
  await page.screenshot({ path: out });
  await browser.close();
  console.log("affiche :", out);
})();
