// Turns tutorial-script.md into .out/script.json: chapters, each with narration beats.
const fs = require('fs');
const path = require('path');
const md = fs.readFileSync(path.join(__dirname, 'tutorial-script.md'), 'utf8');
const WPS = 2.45; // Azure en-IN at the default rate speaks about 145–150 words a minute.
const chapters = [];
for (const block of md.split(/\n## /).slice(1)) {
  const head = block.split('\n')[0];
  const m = head.match(/^(\d+)\.\s+(.+?)\s+\*\(/);
  if (!m) continue;
  const vo = block.split('**VO:**')[1];
  if (!vo) continue;
  const lines = vo
    .split(/\n---|\n### /)[0]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const beats = lines.map((text) => ({ text, est: +(text.split(/\s+/).length / WPS + 0.5).toFixed(2) }));
  chapters.push({ n: +m[1], title: m[2].replace(/^For Coordinators: /, 'For Coordinators: '), beats });
}
fs.mkdirSync(path.join(__dirname, '.out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '.out', 'script.json'), JSON.stringify(chapters, null, 2));
let total = 0;
for (const c of chapters) {
  const s = c.beats.reduce((a, b) => a + b.est, 0);
  total += s + 2.5;
  console.log(String(c.n).padStart(2), c.title.padEnd(52), c.beats.length, 'beats', s.toFixed(0) + 's');
}
console.log('total ~', (total / 60).toFixed(1), 'min');
