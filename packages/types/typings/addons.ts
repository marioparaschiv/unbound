import type { ReactNode } from 'react';

/** The author of an addon: a display name and a numeric user id. */
export type AddonAuthor = {
	name: string;
	id: `${number}`;
};

/** The manifest describing an addon's metadata, entry point, and source. */
export interface AddonManifest {
	id: string;
	/** The addon kind this manifest describes; used to validate installs. */
	type?: 'plugin' | 'theme' | 'icon-pack' | 'font';
	name: string;
	description: string;
	authors: AddonAuthor[];
	icon: (string & {}) | { uri: string };
	updates: string;
	main: string;
	version: string;
	folder: string;
	path: string;
	url: string;
}

/** A loaded addon entity: its runtime state, instance, source bundle, and {@link AddonManifest}. */
export interface Addon {
	started: boolean;
	instance: any;
	id: string;
	failed: boolean;
	data: AddonManifest;
	bundle: string;
}

/** An addon referenced either by its id string or the {@link Addon} entity itself. */
export type AddonResolveable = string | Addon;

/** An {@link Addon} whose instance is a {@link Plugin}. */
export type PluginEntity = Addon & {
	instance: Plugin | null;
};

/** The lifecycle and settings contract implemented by a plugin. */
export interface Plugin {
	start?(): void;
	stop?(): void;
	getSettingsPanel?(): ReactNode;
}

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
export interface Theme {
	semantic: Record<PropertyKey, ThemeSemanticColor>;
	raw: Record<PropertyKey, string>;
	type: 'midnight' | 'darker' | 'light';
	background?: {
		blur?: number;
		opacity?: number;
		url: string;
	};
}

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
