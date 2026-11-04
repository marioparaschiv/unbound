---
banner: media/banner.png
---

## :sparkle: What it does

- :shield-user: A **View Permissions** row opens what a member, channel or server allows and denies.
- :user: On a profile opened from a server, the row, and a **View Permissions** button under the roles card, list each permission the member has and the role that grants it. **Role Details** opens the full role list.
- :msgs: On a channel's long-press sheet, the row lists the channel's role and member overwrites, from the highest role down, with what each allows and denies.
- :server: On a server's sheet and long-press menu, the row lists every role, and what each one grants.
- :users: User menus inside a server and the overflow menu of a server profile get **View Permissions** too, opening the member's roles and, for the owner, an **@owner** entry with every permission. The profile overflow menu carries no user, so it is recognized by its English item labels and works only with Discord in English.
- :cursor-default: Tap an entry at the top of the list to see its permissions, tap a permission to read Discord's description of it, and long-press an entry to copy its role or user ID.
- :refresh: Members named in a channel's overwrites that the app hasn't loaded yet are requested and appear once they arrive.
- :code-fork: A port of Vencord's PermissionsViewer.

## :gear: Settings

- :arrow-up: **Permissions Sort Order**: **Highest Role**, the default, or **Lowest Role** decides which role is shown as granting a permission. The member sheet's sort button flips it too.
- :toggle: **Roles Card Button**: on by default. Turn it off to keep only the sheet row and menu item on profiles.

## :circle-info: Differences from Vencord

- :mobile: Discord mobile has no right-click menus, popouts or tooltips, so the context menu items are action sheet rows, the popout is a sheet, and "Granted by" shows beside each permission instead of on hover.
- :puzzle-piece: The role menu inside the list offers **Copy ID** by long-press only. Vencord's extra role items come from its BetterRoleContext plugin, and its hidden **View As Role** item has no setting to turn it on, so neither is here.
