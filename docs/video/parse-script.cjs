// Turns tutorial-script.md into .out/script.json: the video's chapters in order,
// each with narration beats. A beat has `text` (the subtitle), `speak` (the same
// line spelt for the voice: see SAY), `pop` (the on-screen label, if any) and
// `est`, a length estimate in seconds until real voice clips exist.
const fs = require('fs');
const path = require('path');

const md = fs.readFileSync(path.join(__dirname, 'tutorial-script.md'), 'utf8');
const WPS = 2.4; // a calm narration pace, about 145 words a minute

// Pronunciation: subtitles keep the normal spelling, the voice reads these.
const SAY = [
  [/\bAOP\b/g, 'A-O-P'],
  [/\bHODs\b/g, 'H-O-Ds'],
  [/\bHOD\b/g, 'H-O-D'],
  [/\bNOC\b/g, 'N-O-C'],
  [/\bLounge\b/g, 'Lownge'], // otherwise the voice says "launch"
  [/₹\s?([\d.]+)\s?Cr\b/g, '$1 crore rupees'],
];
const speak = (text) => SAY.reduce((s, [re, to]) => s.replace(re, to), text);

/** Numbered narration lines ("1. Text. ★ *Label*") from a block of markdown. */
function beatsOf(block) {
  return block
    .split('\n')
    .map((l) => l.match(/^\d+\.\s+(.*)$/))
    .filter(Boolean)
    .map(([, line]) => {
      const pop = (line.match(/★\s*\*(.+?)\*/) || [])[1] || null;
      const text = line.replace(/\s*★.*$/, '').trim();
      return { text, speak: speak(text), pop, est: +(text.split(/\s+/).length / WPS + 0.6).toFixed(2) };
    });
}

const chapters = [];
let part = 0;
for (const section of md.split(/\n(?=#{1,3} )/)) {
  const head = section.split('\n')[0];
  let m;
  if ((m = head.match(/^# PART (\d+) – (.+)$/))) {
    part = +m[1];
    const card = section.match(/\*\*\[ROLE TITLE CARD[\s\S]*?(?=\n\*\*\[Badge)/);
    const quoted = (card ? card[0] : '')
      .split('\n')
      .filter((l) => l.startsWith('>'))
      .map((l) => l.replace(/^>\s?/, ''));
    const vo = section.split('**VO:**')[1] || '';
    chapters.push({
      id: `p${part}card`,
      kind: 'card',
      part,
      title: m[2].replace(/\b(\w)(\w*)/g, (_, a, b) => a + b.toLowerCase()),
      who: (quoted.find((l) => l.startsWith('**') && l.includes('·') && !l.startsWith('**Part')) || '').replace(
        /\*\*/g,
        '',
      ),
      can: quoted.filter((l) => l.startsWith('- ')).map((l) => l.slice(2)),
      beats: beatsOf(vo.split('**[Badge')[0]),
    });
  } else if ((m = head.match(/^### Step (\d+) · (.+?)\s+\(~/))) {
    chapters.push({ id: `p${part}s${m[1]}`, kind: 'step', part, step: +m[1], title: m[2], beats: beatsOf(section) });
  } else if ((m = head.match(/^## (Opening|Closing)\b/))) {
    chapters.push({
      id: m[1] === 'Opening' ? 'open' : 'close',
      kind: 'step',
      part: 0,
      title: m[1],
      beats: beatsOf(section),
    });
  }
}

fs.mkdirSync(path.join(__dirname, '.out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '.out', 'script.json'), JSON.stringify(chapters, null, 2));
let total = 0;
for (const c of chapters) {
  const s = c.beats.reduce((a, b) => a + b.est, 0);
  total += s + (c.kind === 'step' && c.part ? 1.5 : 0);
  console.log(c.id.padEnd(7), c.title.padEnd(48), String(c.beats.length).padStart(2), 'beats', s.toFixed(0) + 's');
}
console.log('total ~', (total / 60).toFixed(1), 'min');
