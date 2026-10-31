import type { ReactNode } from 'react';

import type { NativePluginCapability, NativePluginPlatform, PluginContext } from './native';

/** The kinds of addon a manifest can declare. */
export const ADDON_TYPES = ['plugin', 'theme', 'icon-pack', 'font'] as const;

export type AddonType = (typeof ADDON_TYPES)[number];

/** The addon managers. Each names its settings store and its Cloud Sync section. */
export const MANAGER_KINDS = ['plugins', 'themes', 'icons', 'fonts'] as const;

export type ManagerKind = (typeof MANAGER_KINDS)[number];

/** The author of an addon: a display name and a numeric user id. */
export type AddonAuthor = {
	name: string;
	id: `${number}`;
};

/** The manifest an author ships in an addon's `manifest.json`: its metadata and entry point. */
export type AuthoredAddonManifest = {
	id: string;
	/** The addon kind this manifest describes; used to validate installs. */
	type?: AddonType;
	name: string;
	description: string;
	authors: AddonAuthor[];
	icon?: string | { uri: string };
	main: string;
	version: string;
	platforms?: NativePluginPlatform[];
	capabilities?: NativePluginCapability[];
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

/** A loaded addon entity: its runtime state, instance, source bundle, and {@link AddonManifest}. */
export type Addon = {
	started: boolean;
	/** What the bundle evaluated to. Every addon kind may implement the {@link Plugin} lifecycle hooks. */
	instance: Plugin | null;
	context?: PluginContext;
	id: string;
	failed: boolean;
	data: AddonManifest;
	bundle: string;
};

/** An addon referenced either by its id string or the {@link Addon} entity itself. */
export type AddonResolveable = string | Addon;

/** An {@link Addon} whose instance is a {@link Plugin}. */
export type PluginEntity = Addon & {
	instance: Plugin | null;
};

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

/** An {@link Addon} whose instance is a {@link Theme}, tracking its registration state. */
export type ThemeEntity = Addon & {
	registered: boolean;
	instance: Theme | null;
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
