# Unbound

A client mod for Discord's mobile app that loads user-installed addons and exposes an API for them.

## Language

### Settings

**Setting**:
One persisted key and value, such as whether a plugin is enabled.
_Avoid_: Preference, option

**Bucket**:
A named, persisted group of settings owned by one part of Unbound or one addon, such as `plugins` or `unbound::sync`.
_Avoid_: Store, settings store, hive, namespace

**Settings section**:
A page Unbound or an addon adds to Discord's settings screen.
_Avoid_: Settings, settings page

### Addons

**Addon**:
A plugin, theme, icon pack or font a user installs into Unbound.
_Avoid_: Extension, add-on

**Manifest**:
An addon's `manifest.json`, the source of truth for its id, name, version and authors.
_Avoid_: Metadata, addon info

**Feature**:
One independently loaded part of an addon, such as a patch, often with a setting that turns it on.
_Avoid_: Submodule, sub-plugin

**Command**:
A slash command an addon registers in Discord's chat input.
_Avoid_: Chat command, application command

**Addon scope**:
The globals object a plugin bundle is evaluated with, such as its own `patcher`, `logger` and timers; everything registered through it is disposed when the plugin stops.
_Avoid_: Sandbox, plugin environment

**Capability**:
A named permission to use one part of the native bridge, such as `native.objc.invoke`, granted to an addon per platform.
_Avoid_: Permission, entitlement

**Platform handler**:
The part of an addon that runs on only one platform, selected by `definePlatform`.
_Avoid_: Platform implementation, native module

### Discord

**Flux store**:
One of Discord's own state containers, such as `UserStore`, found through Metro.
_Avoid_: Store

**Flux action**:
An event Discord's dispatcher sends to every Flux store, such as `MESSAGE_CREATE`.
_Avoid_: Event, dispatch

### Account

**Account**:
The Unbound account a user signs in to with Discord, shared by every feature that talks to unbound.rip, such as Sync. The client keeps one session for it.
_Avoid_: Sync account, login, profile

### Sync

**Sync**:
Keeping a user's installed addons and settings the same on every device they sign in on, through Unbound's servers.
_Avoid_: Cloud sync, Cloud Sync, settings sync
