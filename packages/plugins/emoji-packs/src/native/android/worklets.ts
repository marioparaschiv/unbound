import {
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';

import { coverageSets, type Coverage, type CoverageSets } from '~/lib/coverage-sets';
import { packUrl, type PackId } from '~/lib/packs';

const STATE_KEY = '__unboundEmojiPacks';
const UNICODE_PREFIX = 'Unicode(surrogates=';

type PackState = { pack: PackId; sets: CoverageSets | undefined };
type UrlEvent = { self: NativeJavaValue };

function state(): PackState {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, PackState | undefined>;

	return (holder[STATE_KEY] ??= { pack: 'fluent-animated', sets: undefined });
}

function surrogatesOf(java: NativeJavaBridge, emoji: NativeJavaValue): string | undefined {
	'worklet';
	const reference = javaReference(emoji);
	const described = reference && javaText(java.invoke(reference, 'toString', []));

	if (!described?.startsWith(UNICODE_PREFIX)) return undefined;

	const value = described.slice(described.lastIndexOf('=') + 1).replace(/\)+$/, '');

	return value === '' ? undefined : value;
}

/**
 * @description Draws unicode emoji from a pack. Hooks the URL method of Discord's emoji models, which renders each
 * message's emoji, and answers it with the pack's image for unicode ones, leaving custom emoji to Discord.
 * @param scope The plugin's UI scope, which removes the hooks on dispose.
 * @param classes The emoji model classes, from `java.findClasses`.
 * @param pack The pack to start with.
 * @param coverage Which emoji each pack has.
 */
export function installEmojiPack(
	scope: NativeUIScope,
	classes: string[],
	pack: PackId,
	coverage: Coverage,
) {
	'worklet';
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const java = scope.java as NativeJavaBridge;
	const current = state();

	current.pack = pack;
	current.sets = coverageSets(coverage);

	for (const className of classes) {
		hooks.hook(
			className,
			'b',
			['int', 'boolean'],
			{ rewriteResult: true, payload: { arguments: [] } },
			(event: UrlEvent) => {
				const { pack: chosen, sets } = state();
				const surrogates = sets && surrogatesOf(java, event.self);
				const url = surrogates && packUrl(chosen, surrogates, sets);

				return url ? { result: javaString(url) } : undefined;
			},
		);
	}
}

/**
 * @description Sets the pack the next emoji draw uses.
 * @param pack The pack.
 */
export function setEmojiPack(pack: PackId) {
	'worklet';
	state().pack = pack;
}

type AssetEvent = { args: NativeJavaValue[] };

/**
 * @description Draws unicode emoji in Discord's emoji picker from the pack, by answering the static method that builds
 * their bundled image URL with the pack's image instead.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 * @param className The method's obfuscated class.
 * @param method The method's obfuscated name.
 */
export function installPickerEmojiPack(scope: NativeUIScope, className: string, method: string) {
	'worklet';
	const hooks = scope.hooks as NativeJavaHooksBridge;

	hooks.hook(
		className,
		method,
		['java.lang.String'],
		{ rewriteResult: true, payload: { receiver: false } },
		(event: AssetEvent) => {
			const { pack, sets } = state();
			const surrogates = javaText(event.args[0]);
			const url = sets && surrogates && packUrl(pack, surrogates, sets);

			return url ? { result: javaString(url) } : undefined;
		},
	);
}
