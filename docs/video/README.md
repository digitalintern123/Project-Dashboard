# Tutorial video tooling

Builds the "Encalm Projects – How to use the dashboard" tutorial video at 1080p from the approved script in `tutorial-script.md`.

It has two parts, each opening with a role title card (who they are and what they can do in the app):
- **Part 1, Project Coordinator: Priya Sharma.** Seven steps, from signing in to an Email Update.
- **Part 2, Project Lead: Rahul Mehta.** Twelve steps: he creates *Delhi T2 Departure Lounge* and works through its tabs left to right.

A role badge sits in the corner throughout each part. Explained features pop out: the screen dims and the part is enlarged with a label.

The app runs on a **throwaway sample database** with made-up projects and people (`users.mjs`), on port 5073. Nothing here touches `server/data`. Everything generated goes to `docs/video/.out/`, which git ignores.

## Needs
- Node and the repo's dev dependencies (`npm ci`), including Playwright.
- `ffmpeg` with libass and libx264.
- The Inter font for subtitles. Without it, the default font is used.
- Linux tools: `fuser` and `curl`.

## Make the silent video
Run from the repo root:

```bash
npm run build                                    # the sample server serves the built app
node docs/video/parse-script.cjs                 # script → .out/script.json (narration beats)
docs/video/reset.sh                              # fresh sample database + seed
npx playwright test -c docs/video/video.config.ts video-chapters   # record all 21 chapters (~12 min)
docs/video/encode.sh                             # frames → .out/rec/<chapter>.mp4
node docs/video/cards.cjs                        # opening, role title, step and end cards
node docs/video/assemble.cjs                     # → .out/out/Encalm-Projects-Tutorial-silent.mp4 + chapters.txt
```

- Chapter ids are `open`, `p1s1`…`p1s7`, `p2s1`…`p2s12` and `close`; the role cards `p1card` and `p2card` are pictures, not recordings. To record only some chapters, run `CH=p2s6,p2s7 npx playwright test …`.
- Chapters share one database in order: `p2s1` changes Rahul's password, and `p2s3` creates the project that later steps use. Run `reset.sh` before a full recording.
- A chapter fails if an on-screen action runs more than 1 second past its narration line, because picture and voice would drift apart. Shorten the action or split it across lines.

## How the timing works
- Each sentence of narration is a **beat**. A chapter runs a beat's on-screen action, then holds until that beat's time is up.
- Without voice clips, a beat's time is estimated from its word count. Once `.out/audio/durations.json` exists, each beat lasts exactly as long as its spoken clip.
- Subtitles and voice are placed at each beat's real start time.

## Adding the voiceover
The voice is the user's own voice, cloned with their consent using OmniVoice ([VoiceStudio](https://github.com/debpalash/VoiceStudio)'s default engine), run locally. Its reference recording is described in `voice-reference.md`. **Don't commit voice recordings**; they are personal data.

Each beat in `.out/script.json` has `text` (the subtitle) and `speak` (the same line spelt for the voice: A-O-P, H-O-D, N-O-C, "crore rupees"). The voice reads `speak`.

1. Install the tools in a Python venv: `pip install omnivoice faster-whisper`. A GPU isn't needed, but on a 4-core CPU each beat takes 2–4 minutes.
2. Cut 10–15 s of the reference recording at a sentence break: `ffmpeg -i memo.m4a -ss 0.3 -to 14.8 -ac 1 -ar 24000 ref.wav`.
3. `python docs/video/voice-gen.py ref.wav "<exactly what is said in ref.wav>"`: one clip per beat in `.out/audio/raw/<chapter>-<beat>.wav` (e.g. `p2s7-2.wav`). Re-running it skips clips that already exist.
4. `python docs/video/voice-check.py`: transcribes each clip, flags dropped or extra words, trims edge silence into `.out/audio/<chapter>-<beat>.wav` and writes `.out/audio/durations.json` as `{ "p2s7-2": 6.41, … }`. The model sometimes drops a beat's first words, so listen to flagged beats, regenerate them with `voice-gen.py ref.wav "…" p2s7-2 p1s3-0`, and check again.
5. Re-record (`reset.sh`, then the Playwright command) so the scenes match the clip lengths. Run `node docs/video/sync-report.cjs`: it lists each beat's voice length, beat length and dead air, and flags any action that ran more than 0.3 s past its line. Shorten or split a flagged action and record that chapter again. Then run `encode.sh`, `cards.cjs` and `assemble.cjs`.
6. `assemble.cjs` mixes each clip at its beat's start, normalises loudness to -16 LUFS, and writes `.out/out/Encalm-Projects-Tutorial.mp4`.
