## :sparkle: What it does

- :user-minus: Tells you when a friend removes you, or when someone withdraws the friend request they sent you.
- :server: Tells you when you are removed from a server, but not when the server is only down for an outage, or when you stop previewing a server you never joined.
- :msgs: Tells you when you are removed from a group chat.
- :circle-check: Stays quiet about the removals you make yourself: removing a friend, rejecting a request, leaving or deleting a server, or leaving a group chat.
- :clock: When Discord opens or reconnects, it reports what changed while it was closed, compared with what it saw last time. Each account keeps its own record.
- :bell: Each notification is a toast with the server, group or user's picture. Notifications about a person have a **View Profile** button.
- :code-fork: A port of Vencord's RelationshipNotifier.

## :gear: Settings

- :user-minus: **Notify When**: **Friends**, **Friend Requests**, **Servers** and **Group Chats**, all on by default.
- :clock: **Offline Removals** reports removals that happened while Discord was closed. On by default.
- :bell: **Persistent Notices** keeps each notification on screen until you tap **OK**. Off by default.

## :circle-info: Differences from Vencord

- :mobile: Discord mobile has no desktop notifications or notice bar, so notifications are Unbound toasts. **Persistent Notices** stands in for Vencord's notice bar.
- :server: If this Discord build does not say which servers are in an outage, servers missing while Discord was closed are not reported, so an outage never shows up as a removal. Live removals are still reported.
- :database: The record of your servers, groups and friends is saved under `Unbound/Data/relationship-notifier/` in Discord's documents folder instead of Discord's desktop storage, so offline removals start counting from the first time the plugin runs.
