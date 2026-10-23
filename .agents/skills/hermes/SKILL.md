---
name: hermes
description: Read Discord's mobile JavaScript from its decompiled Hermes bytecode. Use when you need how Discord implements something (a store, component, navigation helper, motion preset, settings route) before calling or patching it, or when decompiling a new Discord build.
---

# Discord's Hermes source

Decompiled builds live at `~/.cache/unbound/discord-<version>/`: `main.js` is the whole decompile and `mods/` holds one file per source module, named by original path (`stores/`, `design/`, `modules/user_profile/native/...`). Read the build matching the device's Discord version, else the highest version present. If the build you need is missing, decompile it.

## Decompile a build

Get the IPA with the `dkrypt` skill, then:

```bash
python3 .agents/skills/hermes/scripts/decompile.py <discord.ipa> ~/.cache/unbound/discord-<version>
```

It installs `hermes-dec` on first run (with `uv`, else `python3 -m venv`) and takes about 2 minutes. Bytecode-version warnings in `dec.log` are expected. Done when `mods/stores/UserStore.tsx` exists.

## Find things

Search the source, then confirm live with `ubd eval` from the `unbound-dev` skill. The source shows names and shapes. Only the live runtime proves they still exist.

- **By name.** `grep -rln '<identifier>' ~/.cache/unbound/discord-<version>/mods`. Strings survive decompilation. Local variable names become registers (`r7`).
- **Flux stores** live at `mods/stores/<Name>Store.tsx`. Search `= 'UserStore';`, since the name is assigned through a register. Live: `unbound.metro.findStore('User')`, which appends `Store` unless you pass `{ short: false }`. `unbound.metro.stores` is Unbound's own small set, not Discord's.
- **Modules by props.** Find a distinctive export name in the source, then `unbound.metro.findByProps('<name>')` live.
