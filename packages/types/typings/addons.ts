import type { ReactNode } from 'react';

import type {
	NativePluginPlatformCapability,
	NativePluginCapability,
	NativePluginPlatform,
	PluginContext,
} from './native';

/** The kinds of addon, as a manifest's `type` declares them. One manager governs each, in this start order. */
export const ADDON_KINDS = ['plugin', 'theme', 'icon-pack', 'font'] as const;

/** One addon kind, such as `plugin` or `icon-pack`; each has its own manager. */
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
	'commands',
] as const;

/** The `logger` global a plugin runs with: console levels prefixed with the plugin's name. */
export type AddonLogger = Record<
	'log' | 'info' | 'success' | 'warn' | 'error' | 'debug',
	(...args: unknown[]) => void
>;

/** The author of an addon: a display name and a numeric user id. */
export type AddonAuthor = {
	/** The name shown for the author. */
	name: string;
	/** The author's Discord user id, as a string of digits. */
	id: `${number}`;
};

/** What an addon declares for one platform it runs on: the capabilities that platform provides which it needs. */
export type AddonPlatform<P extends NativePluginPlatform = NativePluginPlatform> = {
	/** Capabilities needed on this platform only, added to the manifest's top-level `capabilities`. */
	capabilities?: NativePluginPlatformCapability<P>[];
};

/** The platforms an addon runs on, keyed by platform. */
export type AddonPlatforms = {
	[P in NativePluginPlatform]?: AddonPlatform<P>;
};

/** The manifest an author ships in an addon's `manifest.json`: its metadata and entry point. */
export type AuthoredAddonManifest = {
	/** The unique id: alphanumeric runs joined by single `.`, `_` or `-`, at most 100 characters. */
	id: string;
	/** The addon kind this manifest describes; used to validate installs. */
	type?: AddonKind;
	/** The display name; must not be empty. */
	name: string;
	/** A short summary shown with the addon; may be empty. */
	description: string;
	/** Who made the addon; a published manifest lists at least one. */
	authors: AddonAuthor[];
	/** An image for the addon, as a URL or an `{ uri }` image source. */
	icon?: string | { uri: string };
	/** The bundle's path relative to the manifest, such as `index.js`; it may not leave the addon's directory. */
	main: string;
	/** The addon's version, in strict SemVer 2.0.0 with no `v` prefix. */
	version: string;
	/**
	 * The platforms the addon runs on, each with the capabilities it needs there; absent means every platform.
	 * Published addons may still carry the older array of platform names.
	 */
	platforms?: AddonPlatforms | NativePluginPlatform[];
	/** Capabilities the addon needs on every platform it runs on. */
	capabilities?: NativePluginCapability[];
	/** @deprecated Use `platforms.<platform>.capabilities`. Still read for published addons. */
	platformCapabilities?: Partial<Record<NativePluginPlatform, NativePluginCapability[]>>;
	/** The lowest native plugin API version the addon supports; an older native bridge fails its start. */
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
	/** The addon's id, as in {@link AuthoredAddonManifest.id}. */
	id: string;
	/** The bundle's path relative to the manifest, as in {@link AuthoredAddonManifest.main}. */
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
export type AddonHandle = {
	/** The manifest's `id`. */
	readonly id: string;
	/** The manifest's display `name`. */
	readonly name: string;
	/** The manifest's `version`. */
	readonly version: string;
	/** The manifest's `authors`. */
	readonly authors: AddonAuthor[];
	/** The loaded manifest, including what the loader and installer recorded. */
	readonly manifest: AddonManifest;
	/** Whether the addon is running. */
	readonly started: boolean;
	/** Whether the addon failed to start. */
	readonly failed: boolean;
	/** Whether the user has the addon enabled, as its manager records it. */
	isEnabled(): boolean;
	/** Whether the plugin manager governs this addon. */
	isPlugin(): boolean;
	/** Asks the addon's manager to enable it. */
	enable(): void | Promise<void>;
	/** Asks the addon's manager to disable it. */
	disable(): void;
	/** Restarts the addon on its current bundle if it is running; settles once it is running again. */
	reload(): Promise<void>;
	/** Returns the manifest, so serializing the addon never leaks its bundle or instance. */
	toJSON(): AddonManifest;
};

/** What a plugin's self-test found: whether the plugin works on this device, and why. */
export type PluginSelfTestResult = {
	/** `true` when the plugin works on this device. */
	ok: boolean;
	/** A human-readable reason for the result. */
	detail: string;
};

/** The lifecycle and settings contract implemented by a plugin. */
export type Plugin = {
	/** Called when the plugin starts, inside its Addon scope, with its native bridge context. */
	start?(context?: PluginContext): void;
	/** Called when the plugin stops; a returned promise is awaited, and the scope is disposed even if it throws. */
	stop?(): void | Promise<void>;
	/** Renders the plugin's settings panel; called only while the plugin is running. */
	getSettingsPanel?(): ReactNode;
	/** Checks, without side effects, that the running plugin works on this device; the device matrix calls it after a restart. */
	selfTest?(): PluginSelfTestResult | Promise<PluginSelfTestResult>;
};

/** A single semantic colour definition in a {@link Theme}. */
export type ThemeSemanticColor = {
	/** `color` uses `value` as is; `raw` names a raw colour, looked up in the theme's `raw` and then Discord's. */
	type: 'color' | 'raw';
	/** A colour string, or the name of a raw colour when `type` is `raw`. */
	value: string;
	/** An alpha from 0 to 1, clamped, that replaces a `#rrggbb` or `#rrggbbaa` colour's alpha; other formats ignore it. */
	opacity?: number;
};

/** A theme's semantic and raw colour definitions plus optional background. */
export type Theme = {
	/** Overrides for Discord's semantic colours, keyed by name such as `BACKGROUND_BASE_LOWER`; malformed entries are dropped. */
	semantic: Record<PropertyKey, ThemeSemanticColor>;
	/** Overrides for Discord's raw palette colours, keyed by raw colour name. */
	raw: Record<PropertyKey, string>;
	/** The Discord base theme the bundle declares; parsed as `darker` when absent or unknown. */
	type: 'midnight' | 'darker' | 'light';
	/** A background image by `url`, with optional `blur` and `opacity`; dropped when `url` is not a string. */
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
	/** The name the pack was loaded under: its manifest `name`, or `Default` for Discord's own icons. */
	bundle: string;
	/** The pack's manifest. */
	manifest: IconPackManifest;
};

/** A custom font the native loader has registered, as injected on `window.UNBOUND_FONTS`. */
export type FontDescriptor = {
	/** The font's PostScript name, else its full name, else its file name without extension; the Fonts manager keys by it. */
	name: string;
	/** The font's file name in Unbound's `Fonts` directory. */
	file: string;
	/** The absolute path to the font file on the device. */
	path: string;
};

/** A font managed by the Fonts manager: currently identical to its {@link FontDescriptor}. */
export type FontEntity = FontDescriptor;
