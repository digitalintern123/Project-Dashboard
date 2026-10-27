# Checks each raw clip against the script with faster-whisper, then trims edge silence into
# .out/audio/<chapter>-<beat>.wav and writes .out/audio/durations.json.
# FLAG means words are missing, added, or the first word was dropped: listen, and regenerate
# with voice-gen.py <ids>. Whisper mishears some words ("Encalm", "e-mails"), so a flag is a hint.
import sys, os, json, re, subprocess, numpy as np
from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, ".out", "audio")
script = json.load(open(os.path.join(HERE, ".out", "script.json")))
m = WhisperModel("small", device="cpu", compute_type="int8")
NUM = {"0": "zero", "100": "one hundred", "10": "ten", "20": "twenty", "7": "seven", "5": "five"}
TRIM = ("silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.12,areverse,"
        "silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.2,areverse")

def norm(s):
    s = s.lower().replace("encalm", "encom").replace("%", " percent").replace("-", " ")
    s = re.sub(r"\b(\d+)\b", lambda x: NUM.get(x.group(1), x.group(1)), s)
    return re.sub(r"[^a-z ]", "", s).split()

def pcm(f):
    cmd = ["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.float32)

dur, bad = {}, []
for c in script:
    for i, b in enumerate(c["beats"]):
        k = f'{c["n"]}-{i}'
        raw = os.path.join(A, "raw", k + ".wav")
        pad = np.zeros(8000, np.float32)  # whisper skips a first word that starts at 0 s
        heard = " ".join(s.text for s in m.transcribe(np.concatenate([pad, pcm(raw), pad]), language="en", beam_size=5)[0])
        want, got = norm(b["text"]), norm(heard)
        miss = len(set(want) - set(got)) / len(set(want))
        extra = len(set(got) - set(want)) / len(set(want))
        flag = miss > 0.12 or extra > 0.2 or want[0] not in got[:3]
        if flag:
            bad.append(k)
        print(f"{k:5} miss={miss:.2f} extra={extra:.2f} {'FLAG' if flag else '    '} | {heard.strip()}", flush=True)
        f = os.path.join(A, k + ".wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", TRIM, f], check=True)
        dur[k] = round(len(pcm(f)) / 16000, 2)
json.dump(dur, open(os.path.join(A, "durations.json"), "w"), indent=1)
print("FLAGGED:", " ".join(bad) or "none")
