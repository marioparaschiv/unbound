import type * as React from 'react';

import type { NativeSerializable, NativeSerializableObject } from './native-handles';
import type { NativePluginPlatform } from './native';
import type { Plugin } from './addons';

/** Facts about the device Discord runs on. */
export type NativePlatformDevice = {
	/** The host platform. */
	readonly platform: NativePluginPlatform;
	/** The device's model name. */
	getDeviceModel(): string;
	/** The operating system's version. */
	getOSVersionString(): string;
	/** Whether the device is jailbroken on iOS or has an `su` binary on Android. */
	isRooted(): boolean;
	/** Whether Discord is installed as a system app. */
	isSystemApp(): boolean;
	/** Whether Discord runs in a simulator, emulator or virtual machine. */
	isVirtualDevice(): boolean;
};

/** iOS-only facts about Discord's code signature. */
export type NativePlatformIOSBridge = {
	/** Discord's code-signing entitlements, as an object. */
	getEntitlements(): NativeSerializableObject;
	/** Discord's code-signing entitlements, as plist text. */
	getEntitlementsAsPlist(): string;
};

/** Facts about the Discord install the loader runs in. */
export type NativePlatformApp = {
	/** Where Discord was installed from, such as `App Store` or `Google Play`. */
	getAppSource(): string;
	/** The framework that injected the loader, such as Vector or LSPosed on Android and ElleKit on iOS, or an empty string. Missing on older loaders. */
	getFramework?(): string;
	/** Whether the loader's embedded attestation verified against Unbound's pinned key. False for development builds. Missing on older loaders. */
	isVerifiedBuild?(): boolean;
	/** True for the first caller in this process; a reloaded runtime sees false. Missing on older loaders. */
	claimLaunchURL?(): boolean;
};

/** File operations inside the Unbound folder in Discord's documents directory. */
export type NativePlatformFiles = {
	/** Removes a file or folder tree, by path relative to the Unbound folder; returns whether anything was removed. */
	remove(path: string): boolean;
};

/** What an addon was doing when the loader blamed it: `starting` or `running` for a crash, `frozen` for a freeze. */
export type NativeCrashPhase = 'starting' | 'running' | 'frozen';

/** An addon the loader disabled because Discord crashed or froze in it on consecutive launches. */
export type NativeCrashedAddon = {
	/** The addon's crash guard key, `<bucket>:<addon id>`. */
	readonly id: string;
	/** The addon's display name. */
	readonly name: string;
	/** What the addon was doing; missing on older loaders, which read it as `starting`. */
	readonly phase?: NativeCrashPhase;
};

/** The loader's record of which addon was starting or running when Discord crashed, kept across launches. */
export type NativePlatformCrashGuard = {
	/** Marks an addon as starting, by crash guard key and display name, so a crash during its start is blamed on it. */
	begin(id: string, name: string): boolean;
	/** Clears the start marker once the addon's start has returned. */
	end(id: string): boolean;
	/** Lists the addons the loader disabled after crashes on consecutive launches. */
	disabled(): NativeCrashedAddon[];
	/** Registers an addon for crash attribution and returns its slot, or 0 when the loader cannot attribute crashes. */
	register?(id: string, name: string): number;
	/** Returns a 4-byte buffer shared with the loader that holds the running addon's slot, or `undefined` when unavailable. */
	activity?(): ArrayBuffer | undefined;
};

/** One change to a Bucket: set a key, remove a key, or clear the whole Bucket. Keys are dot paths. */
export type NativeSettingsChange =
	| { store: string; key: string; value: NativeSerializable }
	| { store: string; key: string; remove: true }
	| { store: string; clear: true };

/** Where a font comes from: bundled with Discord, installed on the system, or a font addon. */
export type NativeFontSource = 'app' | 'system' | 'custom';

/** One font the loader can apply. */
export type NativeFontEntry = {
	/** The font's PostScript name, falling back to its full or file name; unique in the list. */
	readonly name: string;
	/** The font's full name, or `name` when the file has none. */
	readonly displayName: string;
	/** The family name, when the font file declares one. */
	readonly family?: string;
	/** The style name, such as `Bold`, when the font file declares one. */
	readonly style?: string;
	/** The font file's path; missing for system fonts the loader lists by name only. */
	readonly path?: string;
	/** Where the font comes from. */
	readonly source: NativeFontSource;
};

/** The outcome of checking an addon's signature against the keys compiled into the loader. */
export type NativeAddonVerification = {
	/** `signed` when a trusted key signed the bundle, `unsigned` when there is no signature, `invalid` when it fails. */
	readonly status: 'signed' | 'unsigned' | 'invalid';
	/** Who signed the addon; set only when `status` is `signed`. */
	readonly signer?: string;
	/** Why verification did not succeed, when the loader can say. */
	readonly problem?: string;
};

/** A plugin bundle the loader evaluated from bytecode: it takes the scoped React and returns the plugin module. */
export type NativeCompiledPlugin = (react: typeof React) => Plugin | { default: Plugin };

/** Loader helpers for verifying and loading installed addons. */
export type NativePlatformAddons = {
	/** Checks a manifest's `signature` against its bundle. */
	verify(manifest: string, bundle: string): NativeAddonVerification;
	/** Evaluates an installed plugin's bundle compiled for this bytecode version, if its digest matches the manifest. */
	evaluateBytecode?(folder: string, bytecodeVersion: number): NativeCompiledPlugin | undefined;
	/** Reads an installed plugin's source, for one the loader handed over without it, if its signature still holds. */
	readSource?(folder: string): string | undefined;
};

/** Hermes' sampling profiler, shared with the loader's freeze watchdog. */
export type NativePlatformProfiler = {
	/** Starts sampling; `false` when the profiler is missing or already running. */
	start(): boolean;
	/** Stops sampling and returns the Chrome trace it recorded, or `undefined` when it was not running. */
	stop(): string | undefined;
};

/** The fonts the loader can apply. */
export type NativePlatformFonts = {
	/** Lists font addons first, then app and system fonts, without duplicate names. */
	list(): NativeFontEntry[];
};

/** The loader's native settings file, which holds every Bucket. */
export type NativePlatformSettings = {
	/** Applies changes and writes the file at once; false when the changes are malformed or the write failed. */
	apply(changes: readonly NativeSettingsChange[]): boolean;
	/** Applies changes in memory, to be written by `flush`. Missing on older loaders. */
	stage?(changes: readonly NativeSettingsChange[]): boolean;
	/** Writes staged changes to the file, if any. Missing on older loaders. */
	flush?(): boolean;
	/** Reads every Bucket with no arguments, one Bucket with `store`, or one dot-path `key`; `undefined` when unset. */
	get?(store?: string, key?: string): NativeSerializable | undefined;
};

/** Platform-wide helpers the loader publishes as `globalThis.NativePlatform`, not scoped to a plugin. */
export type NativePlatformBridge = {
	/** The host platform. */
	readonly platform: NativePluginPlatform;
	/** Evaluates Hermes bytecode in the current runtime; `tag` names it in errors. Throws on invalid bytecode. */
	// UNKNOWN: returns the completion value of arbitrary evaluated bytecode.
	evaluateBytecode(bytecode: ArrayBuffer, tag?: string): unknown;
	/** Facts about the device. */
	readonly device: NativePlatformDevice;
	/** Facts about the Discord install. */
	readonly app: NativePlatformApp;
	/** File removal in the Unbound folder; missing when the loader has no documents directory. */
	readonly files?: NativePlatformFiles;
	/** Crash and freeze attribution for addons; missing when the loader has no documents directory. */
	readonly crashGuard?: NativePlatformCrashGuard;
	/** The native settings file; missing when the loader does not manage settings. */
	readonly settings?: NativePlatformSettings;
	/** The font list; missing when the loader cannot list fonts. */
	readonly fonts?: NativePlatformFonts;
	/** Addon verification and bytecode loading; missing on older loaders. */
	readonly addons?: NativePlatformAddons;
	/** Hermes' sampling profiler; missing on older loaders. */
	readonly profiler?: NativePlatformProfiler;
	/** iOS-only helpers; missing on Android. */
	readonly ios?: NativePlatformIOSBridge;
};
