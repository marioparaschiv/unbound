---
name: unbound-patching
description: Change what Discord does or shows from an Unbound plugin or the client. Use when asked to modify, hide, add to or block Discord behaviour, find a Discord module, store or component, write a before, after, instead or React patch, read Discord's decompiled source, or inspect logs, views, hooks or traces on a device.
---

# Patching Discord

Read only the file the task needs. A modification request usually walks them in order.

| Step                  | File                       | Done when                                               |
| --------------------- | -------------------------- | ------------------------------------------------------- |
| 1. Find what to patch | [target.md](target.md)     | A lookup resolves on device and a trace shows it runs   |
| 2. Look the module up | [metro.md](metro.md)       | The lookup is the cheapest one that stays unique        |
| 3. Write the patch    | [patching.md](patching.md) | The patch waits for its module and composes with others |
| Read Discord's source | [hermes.md](hermes.md)     | You found the module that produces the behaviour        |
| Inspect a device      | [probe.md](probe.md)       | Logs, views, hooks or traces answered the question      |

`scripts/source.sh [version]` prints the decompiled source folder for the vphone's Discord version, building it when missing.

The full guide is `docs/developer/plugins/` (https://unbound.rip/docs/developer/plugins/introduction). Prove the result on device with the `ubd-vphone` skill.
