# Influence test

Checks that "Books and authors you love" really changes the writing, blended with her voice.

1. `influence_test.mjs` drives the real app (demo book) four times with the same "Write from my notes" request:
   A no influences, B du Maurier/Christie/Cleeves, C Flynn/Child (Balanced), D Flynn/Child (Strong).
   Env: `PW` (playwright path), `KEY` (Gemini key), optional `OUT`.
2. `judge.py <output.json>` prints simple measurements and asks a model, blind and shuffled, which
   style each passage follows, how strongly, and how much it still sounds like the author's sample
   (`SAMPLE` = a text file of her own prose). Env: `KEY`, optional `JM` (judge model), `SEED`.

Results on 2026-09-27 (two judge runs): before the fix, Flynn/Child influence scored 3/10. After:
Balanced 5-7/10, Strong 8-9/10, with "sounds like her" 6-7 and 5-7; distinctness rose from 3 to 5-6.
