// Renders the video's cards (1920x1080 PNG) in the app's colours: the opening
// card, a role title card per part (who they are and what they can do), a
// short card per step, and the end card.
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
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Coordinator part in teal, Project Lead part in gold: the same colours as the role badges.
const ROLE = {
  1: { name: 'Project Coordinator', accent: '#e6c58a', band: '#0f2f38' },
  2: { name: 'Project Lead', accent: '#c9a04e', band: '#3a2f14' },
};

const page = (inner, accent = '#e6c58a') => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;font-family:Inter,sans-serif;color:#fff;overflow:hidden;
 background:radial-gradient(1200px 700px at 85% 15%,rgba(201,160,78,.20),transparent 60%),linear-gradient(150deg,#173e49 0%,#1d4d59 55%,#215a5c 100%)}
.wrap{position:absolute;inset:0;padding:110px 150px;display:flex;flex-direction:column;justify-content:space-between}
.logo{height:60px;width:auto;align-self:flex-start}
.eyebrow{font:600 26px/1 Inter;letter-spacing:.28em;text-transform:uppercase;color:${accent};margin-bottom:30px}
h1{font:700 100px/1.04 'Inter Display',Inter;letter-spacing:-.02em;max-width:1500px}
h2{font:300 52px/1.15 'Inter Display',Inter;color:${accent};margin-top:22px}
.rule{width:140px;height:5px;background:${accent};border-radius:3px;margin:40px 0 0}
.foot{display:flex;justify-content:space-between;font:500 26px/1 Inter;color:#cfe0dc;letter-spacing:.04em}
.role{display:grid;grid-template-columns:1fr 1fr;gap:70px;align-items:center}
.can{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:40px 46px}
.can .h{font:700 22px/1 Inter;letter-spacing:.18em;text-transform:uppercase;color:${accent};margin-bottom:24px}
.can li{list-style:none;font:500 31px/1.3 Inter;margin:16px 0;padding-left:44px;position:relative}
.can li:before{content:'';position:absolute;left:0;top:13px;width:18px;height:18px;border-radius:50%;background:${accent}}
.step{font:800 180px/1 'Inter Display',Inter;color:${accent};opacity:.9}
</style></head><body><div class="wrap">${inner}</div></body></html>`;

const cards = [];
cards.push([
  'open',
  page(`<img class="logo" src="${logo}">
  <div><div class="eyebrow">Video tutorial</div><h1>Encalm Projects</h1><h2>How to use the dashboard</h2><div class="rule"></div></div>
  <div class="foot"><span>Part 1 · Project Coordinator &nbsp;·&nbsp; Part 2 · Project Lead</span><span>projects.encalmhospitality.com</span></div>`),
]);
for (const c of chapters) {
  const role = ROLE[c.part];
  if (c.kind === 'card') {
    const [person, does] = (c.who || '').split('·').map((s) => s.trim());
    cards.push([
      c.id,
      page(
        `<img class="logo" src="${logo}">
        <div class="role">
          <div><div class="eyebrow">Part ${c.part}</div><h1>${esc(role.name)}</h1><h2>${esc(person)}</h2>
            <p style="font:400 32px/1.35 Inter;color:#dbe8e4;margin-top:18px">${esc(does.charAt(0).toUpperCase() + does.slice(1))}</p><div class="rule"></div></div>
          <div class="can"><div class="h">What a ${esc(role.name)} can do</div><ul>${c.can.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        </div>
        <div class="foot"><span>Encalm Projects · Video tutorial</span><span>Part ${c.part} of 2</span></div>`,
        role.accent,
      ),
    ]);
  } else if (c.part) {
    const steps = chapters.filter((x) => x.part === c.part && x.kind === 'step').length;
    cards.push([
      c.id,
      page(
        `<img class="logo" src="${logo}">
        <div style="display:flex;align-items:flex-end;gap:60px"><div class="step">${c.step}</div>
          <div style="padding-bottom:18px"><div class="eyebrow">Part ${c.part} · ${esc(role.name)} · Step ${c.step} of ${steps}</div><h1 style="font-size:84px">${esc(c.title)}</h1></div></div>
        <div class="foot"><span>Encalm Projects · Video tutorial</span><span>${esc(role.name)}</span></div>`,
        role.accent,
      ),
    ]);
  }
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
