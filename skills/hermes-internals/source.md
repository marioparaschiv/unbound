# Discord's decompiled source

Scripts sit in this skill's folder: run them by absolute path, never from the working directory. `<skill dir>/scripts/source.sh [version]` prints the folder for the vphone's Discord version (or `version`), decompiling it first when missing (about 2 min; with the `ubd-vphone` skill installed it also fetches the IPA). In it, `main.js` is the whole decompile and `mods/` holds one file per source module, named by original path (`stores/`, `design/`, `modules/user_profile/native/...`).

Another IPA, APK or raw bundle: `python3 scripts/decompile.py <file> <out>`; bytecode-version warnings in `dec.log` are expected.

The source shows names and shapes; only the live runtime proves they still exist ([live.md](live.md)).

**Component prop types**, in the Unbound repo: `bun run generate-discord-types -- <source folder> --report /tmp/typegen.json` regenerates `packages/discord-types/src/*.gen.d.ts` and the build line of its README.
