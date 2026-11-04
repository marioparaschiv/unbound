## :sparkle: What it does

- :wand-sparkle: The reaction picker opens with **Super Reaction** already switched on, so the next emoji you pick is a Super Reaction. Tap the toggle to send a normal reaction instead.
- :circle-check: Only switches the picker for Nitro users, so it never opens Discord's Nitro upsell. Nitro Basic does not include Super Reactions, so it is left alone.
- :pointer: Switches the toggle on once per picker. If you switch it off, it stays off while that picker is open, even as you search, scroll or change emoji categories.
- :video: Caps how many Super Reaction animations play at once on a message, down to none at all.
- :code-fork: A port of Vencord's SuperReactionTweaks.

## :gear: Settings

- :wand-sparkle: **Super React by Default** opens the reaction picker on Super Reactions. On by default.
- :video: **Playing Limit** sets how many Super Reaction animations play at once on one message, from 0, which plays none, to 5, Discord's own limit per message. 5 by default, which leaves Discord's behaviour alone.
- :circle-info: Settings apply right away, with no restart.

## :circle-info: Differences from Vencord

- :lock: Vencord can raise the limit past Discord's own and remove it entirely. Discord's limit is checked inside its compiled burst reaction effects store, which Unbound cannot rewrite on Hermes, so this port can only lower it. **Unlimited Super Reaction Playing** is left out, and **Playing Limit** stops at Discord's limit instead of 100.
- :mobile: Desktop's picker starts its Super Reaction state as on. Mobile's picker state can't be set from outside, so the plugin switches the picker's toggle on as each picker opens. A picker that remembers you switched it off still opens on Super Reactions the next time.
