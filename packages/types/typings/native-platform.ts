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
	/** The active iOS jailbreak's name, such as `Dopamine 2.4`, or an empty string on Android and when none is found; older loaders lack it. */
	getJailbreak?(): string;
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

/** Whether Discord can install another patched build of itself: not patched with LSPatch, patched before in-app installs, waiting on the "Install unknown apps" permission, or ready. */
export type NativeAndroidInstallerAvailability =
	| 'unpatched'
	| 'unsupported'
	| 'needs-permission'
	| 'ready';

/** The Discord install the installer would replace. */
export type NativeAndroidInstallerStatus = {
	/** Whether in-app installs work, or what blocks them. */
	readonly availability: NativeAndroidInstallerAvailability;
	/** Discord's version name, such as `352.17 - Stable`. */
	readonly versionName: string;
	/** The installed split names, `base` first. */
	readonly splits: string[];
};

/** One gzipped split APK of a build to install. */
export type NativeAndroidInstallSplit = {
	/** The split's name: `base` or a config split such as `config.arm64_v8a`. */
	readonly name: string;
	/** Where the gzipped APK downloads from. */
	readonly url: string;
	/** SHA-256 of the APK after it is gunzipped. */
	readonly sha256: string;
	/** Size of the APK in bytes. */
	readonly size: number;
	/** Size of the gzipped download in bytes. */
	readonly compressedSize: number;
};

/** Where a running install is: `confirming` waits on the system prompt; `failed` carries `error`. */
export type NativeAndroidInstallPhase =
	| 'idle'
	| 'downloading'
	| 'installing'
	| 'confirming'
	| 'failed';

/** How far the running install is. */
export type NativeAndroidInstallProgress = {
	/** What the installer is doing now. */
	readonly phase: NativeAndroidInstallPhase;
	/** Gzipped bytes downloaded so far, of `total`. */
	readonly downloaded: number;
	/** Gzipped bytes the install downloads in all. */
	readonly total: number;
	/** Why the last install failed, or `null`. */
	readonly error: string | null;
};

/** Installs another patched Discord build over this one, upgrade or downgrade, downloading only the splits that differ. */
export type NativePlatformAndroidInstaller = {
	/** Reads whether in-app installs work and which Discord is installed. */
	status(): NativeAndroidInstallerStatus;
	/** Opens the system's "Install unknown apps" screen for Discord. */
	requestPermission(): boolean;
	/** SHA-256 of each installed split APK, `null` where it cannot be read. */
	installedSplits(): Promise<Record<string, string | null>>;
	/** Starts installing a build in the background; false when an install is already running. Poll `progress`. */
	install(splits: readonly NativeAndroidInstallSplit[]): boolean;
	/** Reads how far the running install is. */
	progress(): NativeAndroidInstallProgress;
	/** Stops a running download or abandons the install session. */
	cancel(): boolean;
};

/** Android-only helpers; missing on iOS. */
export type NativePlatformAndroidBridge = {
	/** Installs patched Discord builds over this one. */
	readonly installer: NativePlatformAndroidInstaller;
};

/** Facts about the Discord install the loader runs in. */
export type NativePlatformApp = {
	/** Where Discord was installed from, such as `App Store` or `Google Play`. */
	getAppSource(): string;
	/** The framework that injected the loader, such as Vector or LSPosed on Android and ElleKit on iOS, or an empty string. */
	getFramework(): string;
	/** Whether the loader's embedded attestation verified against Unbound's pinned key. False for development builds. */
	isVerifiedBuild(): boolean;
	/** True for the first caller in this process; a reloaded runtime sees false. */
	claimLaunchURL(): boolean;
};

/** File operations inside the Unbound folder in Discord's documents directory. */
export type NativePlatformFiles = {
	/** Removes a file or folder tree, by path relative to the Unbound folder; returns whether anything was removed. */
	remove(path: string): boolean;
	/** Reads a text file, by path relative to the Unbound folder; `undefined` when it is missing. Older loaders lack it. */
	read?(path: string): string | undefined;
	/** Replaces a text file atomically, by path relative to the Unbound folder; returns whether it was written. Older loaders lack it. */
	write?(path: string, text: string): boolean;
};

/** What an addon was doing when the loader blamed it: `starting` or `running` for a crash, `frozen` for a freeze. */
export type NativeCrashPhase = 'starting' | 'running' | 'frozen';

/** An addon the loader disabled because Discord crashed or froze in it on consecutive launches. */
export type NativeCrashedAddon = {
	/** The addon's crash guard key, `<bucket>:<addon id>`. */
	readonly id: string;
	/** The addon's display name. */
	readonly name: string;
	/** What the addon was doing. */
	readonly phase: NativeCrashPhase;
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
	register(id: string, name: string): number;
	/** Returns a 4-byte buffer shared with the loader that holds the running addon's slot, or `undefined` when unavailable. */
	activity(): ArrayBuffer | undefined;
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
	evaluateBytecode(folder: string, bytecodeVersion: number): NativeCompiledPlugin | undefined;
	/** Reads an installed plugin's source, for one the loader handed over without it, if its signature still holds. */
	readSource(folder: string): string | undefined;
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
	/** Applies changes in memory, to be written by `flush`. */
	stage(changes: readonly NativeSettingsChange[]): boolean;
	/** Writes staged changes to the file, if any. */
	flush(): boolean;
	/** Reads every Bucket with no arguments, one Bucket with `store`, or one dot-path `key`; `undefined` when unset. */
	get(store?: string, key?: string): NativeSerializable | undefined;
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
	/** Addon verification and bytecode loading. */
	readonly addons: NativePlatformAddons;
	/** Hermes' sampling profiler. */
	readonly profiler: NativePlatformProfiler;
	/** iOS-only helpers; missing on Android. */
	readonly ios?: NativePlatformIOSBridge;
	/** Android-only helpers; missing on iOS and on loaders without the in-app installer. */
	readonly android?: NativePlatformAndroidBridge;
};
