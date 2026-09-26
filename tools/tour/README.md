# Video tour tooling

Scripts that produce `public/tour/` (the narrated walkthrough shown in the app).

- `narration.json`: script per scene. `narration_additions.json`: scenes for the newer pages, inserted after `insertAfter`.
- `tts.py`: narration via Gemini text-to-speech (env `KEY`, `FF` = ffmpeg path, `MODEL`). It sends the script text only. Style directions get read aloud.
- `verify.py`: transcribes each clip back with Gemini and compares it to the script.
- `record.mjs`: drives the real app with Playwright (canned AI answers), timed to the narration. Env `TOUR` = working dir, `PW` = playwright path.
- `vtt.py`: builds subtitles from `starts.json` and `durations.json`.
- `clips/*.ogg`: verified narration clips (convert to `.wav` in the working dir before use).
