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

### Sync

**Sync**:
Keeping a user's installed addons and settings the same on every device they sign in on, through Unbound's servers.
_Avoid_: Cloud sync, Cloud Sync, settings sync
