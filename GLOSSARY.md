# Unbound

A client mod for Discord's mobile app that loads user-installed addons and exposes an API for them.

## Language

### Settings

**Setting**:
One persisted key and value, such as whether a plugin is enabled.
_Avoid_: Preference, option

**Bucket**:
A named, persisted group of settings owned by one part of Unbound or one addon, such as `plugins` or `unbound::sync`. Not the website's file storage buckets.
_Avoid_: Store, settings store, storage, hive, namespace

**Settings section**:
A page Unbound or an addon adds to Discord's settings screen.
_Avoid_: Settings, settings page, settings entry

**Settings panel**:
The component a plugin exports to show its own settings when the user opens them.
_Avoid_: Settings page, settings screen

### Addons

**Addon**:
A plugin, theme, icon pack or font a user installs into Unbound.
_Avoid_: Extension, add-on, entity

**Addon kind**:
Which of the four an addon is: plugin, theme, icon pack or font, always written in the singular.
_Avoid_: Addon type, `plugins`/`themes`/`icons`/`fonts` as kind names

**Icon pack**:
An addon kind that replaces Discord's icons.
_Avoid_: Icons, icon theme

**Font**:
An addon kind that replaces the typeface Discord draws text with.
_Avoid_: Face, font family

**Built-in**:
A part of Unbound itself that starts and stops like an addon but ships inside Unbound, such as staff mode.
_Avoid_: Core plugin, internal plugin

**Manager**:
The part of Unbound that installs, starts, stops and uninstalls the addons of one kind.
_Avoid_: Addon handler, registry

**Manifest**:
An addon's `manifest.json`, the source of truth for its id, name, version and authors.
_Avoid_: Metadata, addon info

**Uninstall**:
Removing an addon and its files from the device.
_Avoid_: Delete, remove

**Enabled**:
A plugin the user has turned on, so it starts with Discord; any number can be.
_Avoid_: Active, on

**Applied**:
The one theme, icon pack or font on screen; picking another replaces it.
_Avoid_: Enabled, selected

**Hold**:
A user's choice to keep an addon at one version, so automatic updates leave it there.
_Avoid_: Pin, lock, freeze

**Development copy**:
An addon pushed from a developer's machine; update checks leave it alone until it is installed from the Marketplace again.
_Avoid_: Dev build, sideload

**Feature**:
One independently started part of a plugin, such as a patch or an interceptor, that checks its own setting and modules first and does nothing when either is missing.
_Avoid_: Submodule, sub-plugin, part

**Patch**:
A change a plugin or Unbound makes to one of Discord's functions or components, undone when its owner stops.
_Avoid_: Hook, detour, override

**Command**:
A slash command an addon registers in Discord's chat input. A `ubd` command or a bot command is never just "command" where an addon's could be meant.
_Avoid_: Chat command, application command

**Addon scope**:
The globals object a plugin bundle is evaluated with, such as its own `patcher`, `logger` and timers; everything registered through it is disposed when the plugin stops.
_Avoid_: Sandbox, plugin environment, plugin scope

**Attribution**:
Which addon a piece of running code belongs to, so a crash or freeze inside it is blamed on that addon.
_Avoid_: Addon scope

**Freeze**:
Discord's JavaScript thread stuck inside one addon's code long enough for Unbound to disable that addon.
_Avoid_: Hang, lockup

**Self-test**:
A plugin's own report of whether each of its features works on this device.
_Avoid_: Health check, probe

**Device matrix**:
The run that starts every first-party plugin on real devices, collects their self-tests and looks for leaks.
_Avoid_: Device tests, plugin matrix

### Native

**Native bridge**:
The API a plugin calls native code through: FFI, Objective-C, Java hooks, Fabric views and UI-thread worklets.
_Avoid_: Native plugin, native API

**Capability**:
A named grant to use one part of the native bridge, such as `native.objc.invoke`, given to an addon per platform.
_Avoid_: Permission, entitlement

**Consent**:
The user's approval for an addon to use the capabilities that reach native code unchecked, asked before it first starts.
_Avoid_: Permission, approval

**Plugin context**:
What a plugin's `start` receives: its manifest, platform and the native bridge limited to its capabilities.
_Avoid_: Entity context, native scope

**Platform handler**:
The part of an addon that runs on only one platform, selected by `definePlatform`.
_Avoid_: Platform implementation, native module

**Surface**:
A React tree a plugin draws inside a native view Discord owns, such as a pill in a message row.
_Avoid_: Card, embed, overlay

**Host**:
The native view a Surface is mounted in.
_Avoid_: Container, parent view

### Discord

**Flux store**:
One of Discord's own state containers, such as `UserStore`, found through Metro.
_Avoid_: Store

**Flux action**:
An event Discord's dispatcher sends to every Flux store, such as `MESSAGE_CREATE`.
_Avoid_: Event, dispatch

**Interceptor**:
A function that sees a Flux action before Discord handles it and may change or drop it.
_Avoid_: Middleware, event handler

**Metro module**:
One of the JavaScript modules Discord's app is bundled into, found by a lookup.
_Avoid_: Module (alone), webpack module

**Lookup**:
A search for a Metro module by its props, name or shape.
_Avoid_: Query, finder

### Loader and devices

**Loader**:
Unbound's native part on iOS and Android, which starts the client bundle inside Discord and provides the native bridge.
_Avoid_: Tweak, injector

**Client bundle**:
Unbound's own JavaScript, which the loader runs before Discord's.
_Avoid_: Unbound bundle, core bundle

**Recovery Mode**:
A start of Discord with every addon off, to get past one that breaks it.
_Avoid_: Safe mode

**Debugger bridge**:
The local server that connects `ubd` on a developer's machine to Unbound on a device.
_Avoid_: Bridge (alone), dev server

**Push**:
Sending an addon built on a developer's machine to a device through the debugger bridge, where it lands as a development copy.
_Avoid_: Plugin push, deploy, sideload

**Hot reload**:
Replacing a pushed addon or the client bundle on a running device without restarting Discord.
_Avoid_: HMR, live reload

### Marketplace

**Marketplace**:
The collection of listed addons that users browse and install from, on unbound.rip and inside Unbound.
_Avoid_: Store, catalog, listing

**Catalog**:
The snapshot of every listed addon that Unbound downloads to show the Marketplace offline.
_Avoid_: Index, listing

**Listed addon**:
An addon the Marketplace shows: not delisted, with at least one live version.
_Avoid_: Listing, marketplace addon, published addon

**Addon page**:
An addon's public page on the Marketplace, written in its `ADDON.md`.
_Avoid_: Store page, measured page

**Submission**:
A request for review, either a new listing that claims an addon id or an update that adds a version to an addon.
_Avoid_: Upload, publish request

**Review**:
Staff's decision on a submission: approved, rejected or changes requested.
_Avoid_: Approval, moderation

**Live version**:
A version an addon can serve: its files are written and no rollback withdrew it.
_Avoid_: Published version, active version

**Served version**:
An addon's newest live version, the one installs and updates get.
_Avoid_: Latest version, newest, current version

**Rollback**:
Making an older live version the served one by withdrawing the versions above it.
_Avoid_: Revert, downgrade

**Delist**:
Hiding an addon from the Marketplace while keeping its versions; relisting undoes it.
_Avoid_: Unlist, unpublish, hide

**Maintainer**:
A user allowed to submit updates for an addon; its owner is the maintainer who also manages the others.
_Avoid_: Author, developer, submitter

**First-party**:
An addon from Unbound's own repository, published by CI from a build commit instead of through review.
_Avoid_: Official, built-in, deploy

**Moderation event**:
One recorded staff or system action on an addon or user, such as an approval or a ban; the moderation log is their sequence.
_Avoid_: Audit event, audit log entry

### Discord bot

**Dispatcher**:
One job of Unbound's Discord bot that keeps something in Discord in step with the website, such as addon posts or member roles.
_Avoid_: Track, worker

**Post**:
A Discord message the bot keeps in step with one subject, such as a listed addon or a moderation event.
_Avoid_: Card, announcement, message

### Account

**Account**:
The Unbound account a user signs in to with Discord, shared by every feature that talks to unbound.rip, such as Sync. The client keeps one session for it.
_Avoid_: Sync account, login, profile

**Linked account**:
A Discord or GitHub sign-in connected to an Account.
_Avoid_: Account, provider, connection

### Sync

**Sync**:
Keeping a user's installed addons and settings the same on every device they sign in on, through Unbound's servers.
_Avoid_: Cloud sync, Cloud Sync, settings sync
