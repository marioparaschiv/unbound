import type { SettingsValues } from './fake-settings';

/**
 * The plugin under test's own types, which type `render`'s `settings` and `locale` and `setLocale`. Declare them
 * once, beside the generated typings:
 *
 * ```ts
 * import type { Settings } from '@unbound-app/settings';
 *
 * declare module '@unbound-app/api/testing' {
 * 	interface PluginTypes { settings: Settings; locale: 'en-US' | 'de' }
 * }
 * ```
 */
// oxlint-disable-next-line typescript/no-empty-object-type, typescript/consistent-type-definitions -- declaration merging needs an interface, empty until a plugin adds to it
export interface PluginTypes {}

type Declared<K extends PropertyKey, Fallback> =
	PluginTypes extends Record<K, infer T> ? T : Fallback;

/** The plugin's settings, from {@link PluginTypes}; any settings object until it is declared. */
export type PluginSettings = Declared<'settings', SettingsValues>;

/** The plugin's locale codes, from {@link PluginTypes}; any string until they are declared. */
export type PluginLocale = Declared<'locale', string>;

/** Some of a plugin's settings, sections included in part: what a test overrides. */
export type SettingsOverrides<S = PluginSettings> = {
	[K in keyof S]?: S[K] extends readonly unknown[]
		? S[K]
		: S[K] extends object
			? SettingsOverrides<S[K]>
			: S[K];
};
