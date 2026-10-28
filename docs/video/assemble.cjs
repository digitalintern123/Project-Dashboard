// Builds the final tutorial from .out: opening card, recorded chapters (each
// step after its step card), role title cards held while their narration
// plays, the end card; burned-in subtitles; a chapter list; and the narration
// track when .out/audio/<chapter>-<beat>.wav clips exist.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const V = path.join(__dirname, '.out');
const OUT = path.join(V, 'out');
const TMP = path.join(V, 'build');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const ff = (args) =>
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const probe = (f) =>
  +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
const pad = (n) => String(n).padStart(2, '0');
const FONTS = '/usr/share/fonts/opentype/inter'; // Inter, for subtitles that match the app
const ENC = ['-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30'];

const script = JSON.parse(fs.readFileSync(path.join(V, 'script.json'), 'utf8'));
const durFile = path.join(V, 'audio', 'durations.json');
const durations = fs.existsSync(durFile) ? JSON.parse(fs.readFileSync(durFile, 'utf8')) : {};
/** Same rule as the recorder: the voice clip's length plus a breath, else the estimate. */
const beatLength = (id, i, est) => (durations[`${id}-${i}`] ?? est) + (durations[`${id}-${i}`] ? 0.45 : 0);

function card(name, seconds) {
  const out = path.join(TMP, `card-${name}.mp4`);
  ff([
    '-loop',
    '1',
    '-t',
    seconds.toFixed(2),
    '-i',
    path.join(V, 'cards', `${name}.png`),
    '-vf',
    `fade=in:st=0:d=0.4,fade=out:st=${(seconds - 0.4).toFixed(2)}:d=0.4,scale=1920:1080`,
    ...ENC,
    out,
  ]);
  return out;
}

// ---- Timeline ----
const segments = [];
const chapters = [];
const subs = [];
const voice = [];
let t = 0;
const add = (file) => {
  const start = t;
  segments.push(file);
  t += probe(file);
  return start;
};
const say = (id, beats, startOf) =>
  beats.forEach((b, i) => {
    subs.push({ start: startOf(i).start, end: startOf(i).end - 0.25, text: b.text });
    const wav = path.join(V, 'audio', `${id}-${i}.wav`);
    if (fs.existsSync(wav)) voice.push({ at: startOf(i).start + 0.15, wav });
  });

chapters.push({ at: 0, title: 'Opening' });
add(card('open', 4));
for (const c of script) {
  if (c.kind === 'card') {
    // Role title card: held on screen while its narration plays.
    const lead = 1.2;
    let at = lead;
    const times = c.beats.map((b, i) => {
      const len = beatLength(c.id, i, b.est);
      const span = { start: at, end: at + len };
      at += len;
      return span;
    });
    chapters.push({ at: t, title: `Part ${c.part} · ${c.title}` });
    const start = add(card(c.id, at + 1.0));
    say(c.id, c.beats, (i) => ({ start: start + times[i].start, end: start + times[i].end }));
    continue;
  }
  const rec = path.join(V, 'rec', `${c.id}.mp4`);
  if (!fs.existsSync(rec)) throw new Error(`missing ${rec}: record ${c.id} and run encode.sh`);
  if (c.part) {
    chapters.push({ at: t, title: `   Step ${c.step} · ${c.title}` });
    add(card(c.id, 1.8));
  } else if (c.id === 'close') chapters.push({ at: t, title: 'Closing' });
  const start = add(rec);
  const meta = JSON.parse(fs.readFileSync(path.join(V, 'rec', c.id, 'meta.json'), 'utf8'));
  say(c.id, c.beats, (i) => ({ start: start + meta.beats[i].start, end: start + meta.beats[i].end }));
}
add(card('end', 5));
const total = t;

// ---- Subtitles (ASS, split into readable two-line chunks) ----
const MAX = 84;
function chunks(text) {
  const out = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > MAX && cur) {
      out.push(cur.trim());
      cur = '';
    }
    cur += ' ' + w;
    if (/[.!?:;]$/.test(w) && cur.trim().length > MAX * 0.55) {
      out.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const ts = (s) => {
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${pad(m)}:${sec}`;
};
let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,44,&H00FFFFFF,&H00FFFFFF,&H30493E17,&H30493E17,0,0,0,0,100,100,0,0,3,14,0,2,200,200,46,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
let srt = '';
let k = 0;
for (const s of subs) {
  const parts = chunks(s.text);
  const chars = parts.reduce((a, p) => a + p.length, 0);
  let at = s.start;
  for (const p of parts) {
    const len = ((s.end - s.start) * p.length) / chars;
    ass += `Dialogue: 0,${ts(at)},${ts(at + len - 0.05)},Default,,0,0,0,,${p}\n`;
    const st = (x) => ts(x).replace('.', ',').padStart(11, '0') + '0';
    srt += `${++k}\n${st(at)} --> ${st(at + len - 0.05)}\n${p}\n\n`;
    at += len;
  }
}
fs.writeFileSync(path.join(TMP, 'subs.ass'), ass);
fs.writeFileSync(path.join(OUT, 'Encalm-Projects-Tutorial.srt'), srt);

// ---- Chapter timestamps ----
const mmss = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
const list = chapters.map((c) => `${mmss(c.at)} ${c.title}`).join('\n');
fs.writeFileSync(path.join(OUT, 'chapters.txt'), list + '\n');

// ---- Join, add audio, burn subtitles ----
fs.writeFileSync(path.join(TMP, 'concat.txt'), segments.map((f) => `file '${f}'`).join('\n') + '\n');
const joined = path.join(TMP, 'joined.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'concat.txt'), '-c', 'copy', joined]);

const narration = path.join(TMP, 'narration.wav');
if (voice.length) {
  const inputs = voice.flatMap((v) => ['-i', v.wav]);
  const delays = voice
    .map((v, i) => `[${i + 1}:a]aresample=48000,adelay=${Math.round(v.at * 1000)}:all=1[a${i}]`)
    .join(';');
  const mix = `${delays};[0:a]${voice.map((_, i) => `[a${i}]`).join('')}amix=inputs=${voice.length + 1}:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  ff([
    '-f',
    'lavfi',
    '-t',
    total.toFixed(2),
    '-i',
    'anullsrc=r=48000:cl=mono',
    ...inputs,
    '-filter_complex',
    mix,
    '-map',
    '[out]',
    '-ar',
    '48000',
    narration,
  ]);
} else {
  ff(['-f', 'lavfi', '-t', total.toFixed(2), '-i', 'anullsrc=r=48000:cl=mono', narration]);
}

const final = path.join(OUT, voice.length ? 'Encalm-Projects-Tutorial.mp4' : 'Encalm-Projects-Tutorial-silent.mp4');
ff([
  '-i',
  joined,
  '-i',
  narration,
  '-vf',
  `ass=${path.join(TMP, 'subs.ass')}${fs.existsSync(FONTS) ? `:fontsdir=${FONTS}` : ''}`,
  ...ENC,
  '-c:a',
  'aac',
  '-b:a',
  '160k',
  '-shortest',
  '-movflags',
  '+faststart',
  final,
]);

console.log(
  `${final}\n${mmss(total)} total, ${segments.length} segments, ${subs.length} narration lines, ${voice.length} voice clips`,
);
console.log(list);
