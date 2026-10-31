import type { ReactNode } from 'react';

import type {
	NativePluginPlatformCapability,
	NativePluginCapability,
	NativePluginPlatform,
	PluginContext,
} from './native';

/** The kinds of addon, as a manifest's `type` declares them. One manager governs each, in this start order. */
export const ADDON_KINDS = ['plugin', 'theme', 'icon-pack', 'font'] as const;

export type AddonKind = (typeof ADDON_KINDS)[number];

/**
 * The globals a plugin bundle is evaluated with, in parameter order. Bytecode compiled against an earlier
 * list receives them by position, so new globals are only ever appended.
 */
export const ADDON_SCOPE_GLOBALS = [
	'React',
	'unbound',
	'addon',
	'patcher',
	'logger',
	'setTimeout',
	'setInterval',
	'clearTimeout',
	'clearInterval',
] as const;

/** @deprecated Use ADDON_KINDS */
export const ADDON_TYPES = ADDON_KINDS;

/** @deprecated Use AddonKind */
export type AddonType = AddonKind;

/** @deprecated Use ADDON_KINDS */
export const MANAGER_KINDS = ['plugins', 'themes', 'icons', 'fonts'] as const;

/** @deprecated Use AddonKind */
export type ManagerKind = (typeof MANAGER_KINDS)[number];

/** The author of an addon: a display name and a numeric user id. */
export type AddonAuthor = {
	name: string;
	id: `${number}`;
};

/** What an addon declares for one platform it runs on: the capabilities that platform provides which it needs. */
export type AddonPlatform<P extends NativePluginPlatform = NativePluginPlatform> = {
	capabilities?: NativePluginPlatformCapability<P>[];
};

/** The platforms an addon runs on, keyed by platform. */
export type AddonPlatforms = {
	[P in NativePluginPlatform]?: AddonPlatform<P>;
};

/** The manifest an author ships in an addon's `manifest.json`: its metadata and entry point. */
export type AuthoredAddonManifest = {
	id: string;
	/** The addon kind this manifest describes; used to validate installs. */
	type?: AddonKind;
	name: string;
	description: string;
	authors: AddonAuthor[];
	icon?: string | { uri: string };
	main: string;
	version: string;
	/**
	 * The platforms the addon runs on, each with the capabilities it needs there; absent means every platform.
	 * Published addons may still carry the older array of platform names.
	 */
	platforms?: AddonPlatforms | NativePluginPlatform[];
	capabilities?: NativePluginCapability[];
	/** @deprecated Use `platforms.<platform>.capabilities`. Still read for published addons. */
	platformCapabilities?: Partial<Record<NativePluginPlatform, NativePluginCapability[]>>;
	minNativePluginApi?: string;
	/** The Ed25519 signature the Unbound team's publish pipeline puts on first-party plugins. */
	signature?: {
		version: 1;
		ed25519: string;
	};
	/** Marks a plugin other plugins build on, which the plugin list hides by default. */
	library?: boolean;
	/** The addons this one needs, by id, each with the semver range it accepts, such as `^1.2.0`. */
	dependencies?: Record<string, string>;
	/** The SHA-512 of each bundle compiled to Hermes bytecode, by bytecode version; covered by `signature`. */
	bytecode?: Record<string, string>;
	/** Requirements on the Unbound client running the addon. */
	unbound?: {
		/** The minimum Unbound client version (semver) the addon supports. */
		min?: string;
	};
};

/** A loaded addon's manifest: the {@link AuthoredAddonManifest} plus what the loader and installer record. */
export type AddonManifest = AuthoredAddonManifest & {
	/** Set by the loader for an addon it read from disk: the addon's folder name. */
	folder?: string;
	/** Set by the loader for an addon it read from disk: the addon's absolute directory. */
	path?: string;
	/** Set by the loader and installer: whether the bundle carries a valid Unbound signature. */
	trust?: AddonTrust;
};

/**
 * A manifest pushed by `ubd dev`. The CLI only checks the fields it reads; the device validates the
 * whole manifest the same way it validates one it loads, so a dev build is never held to the publish rules.
 */
export type PushedManifest = {
	id: string;
	main: string;
	/** The SHA-512 of each bytecode build the push carries, by bytecode version; the CLI fills it in. */
	bytecode?: Record<string, string>;
};

/** Whether an addon's bundle carries a valid Unbound signature. */
export type AddonTrust = 'signed' | 'unsigned';

/**
 * A loaded plugin, theme or icon pack its manager governs: its manifest and state, and what its manager
 * does to it. Stringifies to its {@link AddonManifest}.
 */
export type AddonHandle<I extends object = object> = {
	readonly id: string;
	readonly name: string;
	readonly version: string;
	readonly authors: AddonAuthor[];
	readonly manifest: AddonManifest;
	/** Whether the addon is running. */
	readonly started: boolean;
	/** Whether the addon failed to start. */
	readonly failed: boolean;
	/** @deprecated Use manifest */
	readonly data: AddonManifest;
	/** @deprecated What the bundle evaluated to; readable until 1.0. */
	readonly instance: (Plugin & I) | null;
	/** @deprecated The bundle source; readable until 1.0. */
	readonly bundle: string;
	/** @deprecated The running plugin's native bridge; readable until 1.0. */
	readonly context?: PluginContext;
	isEnabled(): boolean;
	isPlugin(): boolean;
	enable(): void | Promise<void>;
	disable(): void;
	reload(): Promise<void>;
	toJSON(): AddonManifest;
};

/** @deprecated Use AddonHandle */
export type Addon = AddonHandle;

/** @deprecated Use AddonHandle */
export type AddonResolveable = string | AddonHandle;

/** @deprecated Use AddonHandle */
export type PluginEntity = AddonHandle<Plugin>;

/** @deprecated Use AddonHandle */
export type ThemeEntity = AddonHandle<Theme>;

/** What a plugin's self-test found: whether the plugin works on this device, and why. */
export type PluginSelfTestResult = {
	ok: boolean;
	detail: string;
};

/** The lifecycle and settings contract implemented by a plugin. */
export type Plugin = {
	start?(context?: PluginContext): void;
	stop?(): void | Promise<void>;
	getSettingsPanel?(): ReactNode;
	/** Checks, without side effects, that the running plugin works on this device; the device matrix calls it after a restart. */
	selfTest?(): PluginSelfTestResult | Promise<PluginSelfTestResult>;
};

/** A single semantic colour definition in a {@link Theme}. */
export type ThemeSemanticColor = {
	type: 'color' | 'raw';
	value: string;
	opacity?: number;
};

/** A theme's semantic and raw colour definitions plus optional background. */
export type Theme = {
	semantic: Record<PropertyKey, ThemeSemanticColor>;
	raw: Record<PropertyKey, string>;
	type: 'midnight' | 'darker' | 'light';
	background?: {
		blur?: number;
		opacity?: number;
		url: string;
	};
};

/** An icon pack's manifest: an {@link AddonManifest} tagged with its source kind. */
export type IconPackManifest = AddonManifest & {
	type: 'icon-pack';
	source: 'github' | 'other';
};

/** A loaded icon pack: its bundle marker and {@link IconPackManifest}. */
export type IconPack = {
	bundle: string;
	manifest: IconPackManifest;
};

/** A custom font the native loader has registered, as injected on `window.UNBOUND_FONTS`. */
export type FontDescriptor = {
	name: string;
	file: string;
	path: string;
};

/** A font managed by the Fonts manager: currently identical to its {@link FontDescriptor}. */
export type FontEntity = FontDescriptor;
