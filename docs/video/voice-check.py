# Cleans each raw clip into .out/audio/<chapter>-<beat>.wav, writes .out/audio/durations.json,
# then checks every cleaned clip word by word against the script with faster-whisper.
# GLITCH means a word is missing, an extra sound was spoken (often garbled), a word is unclear,
# or a word is stretched (a slurred or dragged syllable): listen, and regenerate with
# voice-gen.py <ids>. Whisper mishears some names ("Encalm"), so check a flag by ear.
import sys, os, json, re, difflib, subprocess, numpy as np
from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, ".out", "audio")
script = json.load(open(os.path.join(HERE, ".out", "script.json")))
m = WhisperModel("medium", device="cpu", compute_type="int8")
NUM = {"0": "zero", "1": "one", "100": "one hundred", "10": "ten", "20": "twenty", "7": "seven", "5": "five", "40": "forty"}
# Trim the ends, shorten pauses inside a line to about 0.25 s, then a little presence,
# de-essing and gentle compression so the voice is clear and even.
CLEAN = ("highpass=f=80,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1:"
         "stop_periods=-1:stop_duration=0.3:stop_threshold=-40dB:stop_silence=0.22,"
         "equalizer=f=3000:t=q:w=1.2:g=2,deesser=i=0.3,"
         "acompressor=threshold=-22dB:ratio=2.5:attack=8:release=120:makeup=2")
PAD = 0.5  # whisper skips a first word that starts at 0 s

def norm(s):
    s = s.lower().replace("encalm", "encom").replace("%", " percent").replace("-", " ").replace("’", "'")
    s = re.sub(r"\b(\d+)\b", lambda x: NUM.get(x.group(1), x.group(1)), s)
    return re.sub(r"[^a-z' ]", "", s).split()

def pcm(f):
    cmd = ["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.float32)

def glitches(text, audio):
    pad = np.zeros(int(PAD * 16000), np.float32)
    segs = m.transcribe(np.concatenate([pad, audio, pad]), language="en", word_timestamps=True, beam_size=5)[0]
    # One entry per spoken token: "100%" is "one hundred percent", "1." is "one".
    words = [(t, w) for s in segs for w in s.words for t in (norm(w.word) or [""])]
    want, got = norm(text), [h for h, _ in words]
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, want, got, autojunk=False).get_opcodes():
        if op in ("insert", "replace") and j2 - j1 > i2 - i1:
            out.append(f"extra '{' '.join(got[j1:j2])}' at {max(0, words[j1][1].start - PAD):.1f}s")
        elif op in ("delete", "replace") and i2 - i1 > 1:
            out.append(f"missing '{' '.join(want[i1:i2])}'")
    for h, w in words:
        at = max(0, w.start - PAD)
        if w.probability < 0.45 and h not in ("encom", "income", "ncom"):
            out.append(f"unclear '{w.word.strip()}' at {at:.1f}s")
        if w.end - max(w.start, PAD) > 0.85 and not w.word.strip().endswith((".", ",")):
            out.append(f"stretched '{w.word.strip()}' at {at:.1f}s")
    return out

dur, bad = {}, []
for c in script:
    for i, b in enumerate(c["beats"]):
        k = f'{c["id"]}-{i}'
        f = os.path.join(A, k + ".wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(A, "raw", k + ".wav"), "-af", CLEAN, f], check=True)
        audio = pcm(f)
        dur[k] = round(len(audio) / 16000, 2)
        issues = glitches(b["text"], audio)
        if issues:
            bad.append(k)
        print(f"{k:9} {'GLITCH' if issues else 'clean '} {'; '.join(issues)}", flush=True)
json.dump(dur, open(os.path.join(A, "durations.json"), "w"), indent=1)
print("GLITCHES:", " ".join(bad) or "none")
