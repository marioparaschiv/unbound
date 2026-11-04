import type {
	DiscordExportName,
	DiscordModulePath,
	DiscordModuleProps,
	DiscordModules,
	DiscordModulesByName,
} from '@unbound-app/discord-types/metro';

import type { LooseComponent, LooseModule } from './loose-props';
import type { LiteralUnion } from './utils';

/** A key of {@link DiscordModules}: a typed module's source path, or `~` and a hash of its export names. */
export type MetroModuleKey = Extract<keyof DiscordModules, string>;

/** A prop name `findByProps` takes: an export name of a Discord module, or any other string. */
export type MetroPropName = LiteralUnion<DiscordExportName>;

/** A name `findByName` takes: a default export's runtime name, or any other string. */
export type MetroModuleName = LiteralUnion<Extract<keyof DiscordModulesByName, string>>;

/** A source path `findByFilePath` takes: a Discord module's path, or any other string. */
export type MetroModulePath = LiteralUnion<DiscordModulePath>;

/** The keys exposing one prop: a short union, `string` for a prop too common to narrow, `never` for an unknown one. */
type KeysExposing<K> = K extends keyof DiscordModuleProps ? DiscordModuleProps[K] : never;

/** The keys exposing every prop of `K`: the intersection of each prop's keys. */
type KeysExposingAll<K> = (K extends unknown ? (keys: KeysExposing<K>) => void : never) extends (
	keys: infer Keys,
) => void
	? Keys
	: never;

/**
 * The module `findByProps` returns for the props `K`: the one Discord module exposing them all, or the union of
 * several. `never` when none does, or when every prop is too common to narrow the match.
 */
// One indexed access, never a scan: a generic index into a non-union object is opaque to inference, so a lookup in
// a contextually typed spot does not expand every module.
export type MetroModuleByProps<K> =
	KeysExposingAll<K> extends infer Keys
		? string extends Keys
			? never
			: LooseModule<DiscordModules[Extract<Keys, MetroModuleKey>]>
		: never;

/** The default export `findByName` returns for `N`, or `never` when no Discord module's is named `N`. */
export type MetroModuleByName<N> = LooseComponent<
	DiscordModulesByName[Extract<N, keyof DiscordModulesByName>]
>;

/** The exports `findByFilePath` returns for `P`, or `never` when no Discord module has that path. */
export type MetroModuleByPath<P> = LooseModule<DiscordModules[Extract<P, MetroModuleKey>]>;
