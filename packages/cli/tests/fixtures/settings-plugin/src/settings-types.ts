// Type tests of the generated `@unbound-app/settings` module; `bun run typecheck` runs them.
import {
	settings,
	useSetting,
	type ActionName,
	type EmojiString,
	type HexColor,
	type HttpUrl,
	type SettingKey,
	type Settings,
	type SettingsEntry,
	type Snowflake,
} from '@unbound-app/settings';

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

function expectType<T extends true>(): T | undefined {
	return undefined;
}

expectType<Equal<Settings['greetOnStart'], boolean>>();
expectType<Equal<Settings['compact'], boolean>>();
expectType<Equal<Settings['opacity'], number>>();
expectType<Equal<Settings['size'], number>>();
expectType<Equal<Settings['retries'], number>>();
expectType<Equal<Settings['timeout'], number>>();
expectType<Equal<Settings['nickname'], string>>();
expectType<Equal<Settings['bio'], string>>();
expectType<Equal<Settings['token'], string>>();
expectType<Equal<Settings['homepage'], HttpUrl | ''>>();
expectType<Equal<Settings['owner'], Snowflake | ''>>();
expectType<Equal<Settings['style'], 'cozy' | 'compact'>>();
expectType<Equal<Settings['layout'], 'list' | 'grid'>>();
expectType<Equal<Settings['tags'], ('a' | 'b')[]>>();
expectType<Equal<Settings['words'], string[]>>();
expectType<Equal<Settings['friends'], Snowflake[]>>();
expectType<Equal<Settings['seen'], boolean>>();
expectType<Equal<Settings['appearance']['accent'], HexColor>>();
expectType<Equal<Settings['appearance']['badge'], HexColor>>();
expectType<Equal<'clearCache' extends keyof Settings ? true : false, false>>();
expectType<Equal<EmojiString, string>>();
expectType<Equal<HexColor, `#${string}`>>();
expectType<Equal<HttpUrl, `https://${string}` | `http://${string}`>>();
expectType<Equal<Snowflake, `${bigint}`>>();

expectType<Equal<ReturnType<typeof useSetting<'greetOnStart'>>, boolean>>();
expectType<Equal<ReturnType<typeof useSetting<'appearance'>>, Settings['appearance']>>();
expectType<Equal<ReturnType<typeof useSetting<'appearance.accent'>>, HexColor>>();
expectType<
	Equal<
		SettingKey,
		| 'greetOnStart'
		| 'compact'
		| 'opacity'
		| 'size'
		| 'retries'
		| 'limit'
		| 'timeout'
		| 'nickname'
		| 'bio'
		| 'token'
		| 'homepage'
		| 'owner'
		| 'style'
		| 'layout'
		| 'tags'
		| 'words'
		| 'friends'
		| 'seen'
		| 'appearance'
		| 'appearance.accent'
		| 'appearance.badge'
	>
>();
expectType<Equal<SettingsEntry<'retries'>, number>>();
expectType<Equal<SettingsEntry<'appearance.accent'>, HexColor>>();
expectType<Equal<SettingsEntry<'style'>, 'cozy' | 'compact'>>();
expectType<Equal<SettingsEntry<'appearance'>, Settings['appearance']>>();
expectType<Equal<ActionName, 'clearCache' | 'resetStyle'>>();

/**
 * @description Takes a color setting's value, as plugin code types one with `SettingsEntry`.
 * @param color The accent.
 * @returns The same color.
 */
export function paint(color: SettingsEntry<'appearance.accent'>): string {
	return color;
}

// @ts-expect-error An unknown key is not a setting.
export type Missing = SettingsEntry<'appearance.size'>;
// @ts-expect-error A button is not a setting.
export type Button = SettingsEntry<'clearCache'>;

settings.style = 'compact';
settings.appearance.accent = '#000000';

// @ts-expect-error A choice holds only its options' keys.
settings.style = 'wide';
// @ts-expect-error A color is a hex string.
settings.appearance.accent = 'red';
// @ts-expect-error A boolean holds no number.
settings.greetOnStart = 1;
// @ts-expect-error A section cannot be replaced, only its settings.
settings.appearance = { accent: '#000000', badge: '#FFFFFF' };
// @ts-expect-error An unknown key is not a setting.
void settings.missing;
// @ts-expect-error An unknown path is not a setting.
useSetting('appearance.missing');
