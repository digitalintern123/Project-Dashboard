// Renders the opening, chapter and end cards (1920x1080 PNG) in the app's colours.
const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');
const V = path.join(__dirname, '.out');
const BROWSER =
  process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const chapters = JSON.parse(fs.readFileSync(path.join(V, 'script.json'), 'utf8'));
const logo =
  'data:image/png;base64,' +
  fs.readFileSync(path.join(__dirname, '../../public/encalm-logo-white.png')).toString('base64');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const page = (inner) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;font-family:Inter,sans-serif;color:#fff;overflow:hidden;
 background:radial-gradient(1200px 700px at 85% 15%,rgba(201,160,78,.20),transparent 60%),linear-gradient(150deg,#173e49 0%,#1d4d59 55%,#215a5c 100%)}
.wrap{position:absolute;inset:0;padding:120px 150px;display:flex;flex-direction:column;justify-content:space-between}
.logo{height:64px;width:auto;align-self:flex-start}
.eyebrow{font:600 26px/1 Inter;letter-spacing:.28em;text-transform:uppercase;color:#e6c58a;margin-bottom:34px}
h1{font:700 104px/1.04 'Inter Display',Inter;letter-spacing:-.02em;max-width:1500px}
h2{font:300 56px/1.15 'Inter Display',Inter;color:#e6c58a;margin-top:26px}
.rule{width:140px;height:5px;background:#c9a04e;border-radius:3px;margin:46px 0 0}
.foot{display:flex;justify-content:space-between;font:500 26px/1 Inter;color:#cfe0dc;letter-spacing:.04em}
.tag{display:inline-block;margin-top:34px;padding:12px 26px;border:2px solid #c9a04e;border-radius:40px;font:600 26px/1 Inter;color:#e6c58a;letter-spacing:.06em}
</style></head><body><div class="wrap">${inner}</div></body></html>`;

const cards = [];
cards.push([
  'open',
  page(`<img class="logo" src="${logo}">
  <div><div class="eyebrow">Video tutorial</div><h1>Encalm Projects</h1><h2>How to use the dashboard</h2><div class="rule"></div></div>
  <div class="foot"><span>For Project Leads and Project Coordinators</span><span>projects.encalmhospitality.com</span></div>`),
]);
for (const c of chapters) {
  if (c.n === 0 || c.n === 13) continue;
  const coord = c.n === 12;
  const title = c.title.replace(/^For Coordinators: /, '');
  cards.push([
    `ch${String(c.n).padStart(2, '0')}`,
    page(`<img class="logo" src="${logo}">
    <div><div class="eyebrow">Chapter ${c.n}</div><h1>${esc(title.charAt(0).toUpperCase() + title.slice(1))}</h1>${coord ? '<div class="tag">For Project Coordinators</div>' : ''}<div class="rule"></div></div>
    <div class="foot"><span>Encalm Projects · Video tutorial</span><span>${c.n} / 12</span></div>`),
  ]);
}
cards.push([
  'end',
  page(`<img class="logo" src="${logo}">
  <div><div class="eyebrow">Thank you for watching</div><h1>Need help?</h1><h2>Contact your Project Coordinator</h2><div class="rule"></div></div>
  <div class="foot"><span>The full user manual has more detail on every screen</span><span>projects.encalmhospitality.com</span></div>`),
]);

(async () => {
  const b = await chromium.launch({ executablePath: BROWSER });
  fs.mkdirSync(path.join(V, 'cards'), { recursive: true });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [name, html] of cards) {
    await p.setContent(html);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(V, 'cards', `${name}.png`) });
  }
  await b.close();
  console.log(cards.length, 'cards');
})();
