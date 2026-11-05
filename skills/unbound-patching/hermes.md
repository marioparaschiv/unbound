# Discord's Hermes source

`skills/unbound-patching/scripts/source.sh [version]` prints the folder for the vphone's Discord version (or `version`), decompiling it first when missing (about 2 min; it fetches the IPA from dkrypt when needed). In it, `main.js` is the whole decompile and `mods/` holds one file per source module, named by original path (`stores/`, `design/`, `modules/user_profile/native/...`). Another IPA, APK or raw bundle: `python3 scripts/decompile.py <file> <out>`; bytecode-version warnings in `dec.log` are expected.

The source shows names and shapes; only the live runtime proves they still exist, so confirm with `ubd eval`.

- **By name.** `grep -rln '<identifier>' "$(scripts/source.sh)/mods"`. Strings survive decompilation; local names become registers (`r7`).
- **Flux stores** live at `mods/stores/<Name>Store.tsx`. Search `= 'UserStore';`, since the name is assigned through a register. Live: `unbound.metro.findStore('User')` (appends `Store` unless `{ short: false }`). `unbound.metro.stores` is Unbound's small set, not Discord's.
- **Modules by props.** Take a distinctive export name from the source, then `unbound.metro.findByProps('<name>')` live.
- **Component prop types.** `bun run generate-discord-types -- <source folder> --report /tmp/typegen.json` regenerates `packages/discord-types/src/*.gen.d.ts` and the build line of its README.
