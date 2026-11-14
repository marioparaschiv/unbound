/** Each command's name and the kaomoji it sends. */
export const KAOMOJI = {
	dissatisfaction: '＞﹏＜',
	smug: 'ಠ_ಠ',
	happy: 'ヽ(´▽`)/',
	crying: 'ಥ_ಥ',
	angry: 'ヽ(｀Д´)ﾉ',
	anger: 'ヽ(ｏ`皿′ｏ)ﾉ',
	joy: '<(￣︶￣)>',
	blush: '૮ ˶ᵔ ᵕ ᵔ˶ ა',
	confused: '(•ิ_•ิ)?',
	sleeping: '(ᴗ_ᴗ)',
	laughing: 'o(≧▽≦)o',
} as const;

/** A kaomoji command's name. */
export type KaomojiName = keyof typeof KAOMOJI;

/**
 * @description Builds the message a kaomoji command sends: the message, then the kaomoji, like Discord's `/shrug`.
 * @param name The command.
 * @param message What to send before the kaomoji.
 * @returns The message text.
 */
export function withKaomoji(name: KaomojiName, message = ''): string {
	const text = message.trim();

	return text ? `${text} ${KAOMOJI[name]}` : KAOMOJI[name];
}

export default withKaomoji;
