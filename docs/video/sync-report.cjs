// Checks that picture and voice stay in step, after recording with voice clips.
// For each narration beat: the voice clip's length, how long the on-screen action
// took, and any dead air the action caused. Flags beats whose action outran the
// voice by more than 0.3 s, and chapters whose beats are missing or out of order.
// Exits 1 if anything is flagged.
const fs = require('fs');
const path = require('path');

const V = path.join(__dirname, '.out');
const script = JSON.parse(fs.readFileSync(path.join(V, 'script.json'), 'utf8'));
const durFile = path.join(V, 'audio', 'durations.json');
if (!fs.existsSync(durFile)) throw new Error('no .out/audio/durations.json: make the voice clips first');
const dur = JSON.parse(fs.readFileSync(durFile, 'utf8'));

const BREATH = 0.45; // video-lib.ts adds this after each clip
const flagged = [];
for (const c of script) {
  if (c.kind === 'card') continue; // cards are timed from the clips directly
  const meta = JSON.parse(fs.readFileSync(path.join(V, 'rec', c.id, 'meta.json'), 'utf8'));
  const order = meta.beats.map((b) => b.i).join(',');
  if (order !== c.beats.map((_, i) => i).join(',')) flagged.push(`${c.id}: beats recorded as ${order}`);
  for (const m of meta.beats) {
    const k = `${c.id}-${m.i}`;
    const voice = dur[k];
    if (voice == null) {
      flagged.push(`${k}: no voice clip`);
      continue;
    }
    const took = m.over + voice + BREATH; // the action's time when it overran, else at most this
    const air = m.end - m.start - voice - 0.15; // silence after the clip, before the next beat
    const late = m.over > 0.3;
    if (late) flagged.push(`${k}: action ran ${m.over.toFixed(1)}s past the voice`);
    console.log(
      `${k.padEnd(9)} voice ${voice.toFixed(1).padStart(5)}s  beat ${(m.end - m.start).toFixed(1).padStart(5)}s  ` +
        `air ${air.toFixed(1).padStart(4)}s ${late ? `LATE (action ~${took.toFixed(1)}s)` : ''}  ${m.text.slice(0, 60)}`,
    );
  }
}
console.log(flagged.length ? `\nFLAGGED:\n${flagged.join('\n')}` : '\nIn sync: every action fits its line.');
process.exit(flagged.length ? 1 : 0);
