# Tutorial video tooling

Builds the "Encalm Projects – How to use the dashboard" tutorial video, about 9½ minutes at 1080p with subtitles and chapter cards, from the approved script in `tutorial-script.md`.

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
npx playwright test -c docs/video/video.config.ts video-chapters   # record all 14 chapters (~10 min)
docs/video/encode.sh                             # frames → .out/rec/chNN.mp4
node docs/video/cards.cjs                        # title, chapter and end cards
node docs/video/assemble.cjs                     # → .out/out/Encalm-Projects-Tutorial-silent.mp4 + chapters.txt
```

- To record only some chapters, run `CH=3,7 npx playwright test …`.
- Chapters share one database in order (for example, chapter 5 creates "Mumbai Departure Lounge"). Run `reset.sh` before a full recording.

## How the timing works
- Each sentence of narration is a **beat**. A chapter runs a beat's on-screen action, then holds until that beat's time is up.
- Without voice clips, a beat's time is estimated from its word count. Once `.out/audio/durations.json` exists, each beat lasts exactly as long as its spoken clip.
- Subtitles and voice are placed at each beat's real start time.

## Adding the voiceover
1. Put one WAV per beat in `.out/audio/<chapter>-<beat>.wav` (e.g. `7-2.wav`), and write their lengths in seconds to `.out/audio/durations.json` as `{ "7-2": 6.41, … }`.
2. Re-record (`reset.sh`, then the Playwright command) so the scenes match the clip lengths, then run `encode.sh` and `assemble.cjs`.
3. `assemble.cjs` mixes each clip at its beat's start, normalises loudness to -16 LUFS, and writes `.out/out/Encalm-Projects-Tutorial.mp4`.

The planned voice is a cloned, consenting colleague's voice via [VoiceStudio](https://github.com/debpalash/VoiceStudio), run locally. Its reference recording is described in `voice-reference.md`. **Don't commit voice recordings**; they are personal data.
