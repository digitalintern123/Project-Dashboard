# Speaks every narration beat in the cloned voice with OmniVoice (VoiceStudio's default engine), on CPU.
# Usage: python voice-gen.py <reference.wav> "<reference transcript>" [beat ids, e.g. 7-1 9-2]
# Writes .out/audio/raw/<chapter>-<beat>.wav. Without ids, only beats that have no clip yet.
import sys, os, json, time, wave, numpy as np, torch
from omnivoice import OmniVoice

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, ".out", "audio", "raw")
ref, ref_text, want = sys.argv[1], sys.argv[2], set(sys.argv[3:])
script = json.load(open(os.path.join(HERE, ".out", "script.json")))
torch.set_num_threads(os.cpu_count() or 4)
m = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cpu", dtype=torch.float32)
prompt = m.create_voice_clone_prompt(ref_audio=ref, ref_text=ref_text)
os.makedirs(OUT, exist_ok=True)
for c in script:
    for i, b in enumerate(c["beats"]):
        k = f'{c["n"]}-{i}'
        f = os.path.join(OUT, k + ".wav")
        if (want and k not in want) or (not want and os.path.exists(f)):
            continue
        t = time.time()
        a = m.generate(text=b["text"], language="en", voice_clone_prompt=prompt)[0]
        a = a.detach().cpu().numpy() if torch.is_tensor(a) else np.asarray(a)
        a = np.clip(a.reshape(-1), -1, 1)
        with wave.open(f, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
            w.writeframes((a * 32767).astype("<i2").tobytes())
        print(k, f"{len(a) / 24000:.2f}s audio in {time.time() - t:.0f}s", flush=True)
