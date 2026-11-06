# Finding a patch target

1. **Name the behaviour's fingerprint**: the visible string, its i18n key, an action type, a store name, or the screen's component.
2. **Search the source**: `grep -rln '<fingerprint>' "$(scripts/source.sh)/mods"`. Strings survive decompilation; local names become registers (`r7`). Stores live at `mods/stores/<Name>Store.tsx`; search `= 'UserStore';`, since the name is assigned through a register.
3. **Climb to the narrowest export** that controls it: a store getter or action creator over a whole screen, a row component over its list.
4. **Key the lookup** on its file path or two or three distinctive export names, then confirm it per [live.md](live.md).
