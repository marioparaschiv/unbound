const OFFSET = 0xe0000;
const RADIX = 0x1000;
const LAST = OFFSET + RADIX - 1;
const DELIMITER = '​';
const MAX_COLOR = 0xffffffn;
const MAX_EFFECT = 10_000_000_000_000_000_000n;
const LEGACY_COLORS = /\[#([a-fA-F0-9]{1,6}),#([a-fA-F0-9]{1,6})\]/;

/** What a bio hides: theme colors, a profile effect's SKU id, or both. */
export type ProfileCode = { colors?: [number, number]; effect?: string };

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const hide = (text: string) =>
	Array.from(text, (character) => String.fromCodePoint(character.codePointAt(0)! + OFFSET)).join(
		'',
	);

function hideNumber(value: bigint): string {
	let digits = '';

	for (let rest = value; digits === '' || rest > 0n; rest /= BigInt(RADIX)) {
		digits = String.fromCodePoint(Number(rest % BigInt(RADIX)) + OFFSET) + digits;
	}

	return digits;
}

function readNumber(digits: string, limit: bigint): bigint | undefined {
	if (!digits) return;

	let value = 0n;

	for (const digit of digits) {
		value = value * BigInt(RADIX) + BigInt(digit.codePointAt(0)!);

		if (value > limit) return;
	}

	return value;
}

function hiddenParts(bio: string): [string, string, string] {
	const parts: [string, string, string] = ['', '', ''];
	let index = 0;

	for (const character of bio) {
		const point = character.codePointAt(0)!;

		if (character === DELIMITER) {
			if (index >= 2) break;

			index += 1;
		} else if (point >= OFFSET && point <= LAST) {
			parts[index] += String.fromCodePoint(point - OFFSET);
		} else if (index > 0 || parts[0]) {
			break;
		}
	}

	return parts;
}

function legacyColors(text: string): [number, number] | undefined {
	const match = LEGACY_COLORS.exec(text);

	return match ? [Number.parseInt(match[1]!, 16), Number.parseInt(match[2]!, 16)] : undefined;
}

function pairColors(
	primary: bigint | undefined,
	accent: bigint | undefined,
): [number, number] | undefined {
	const first = primary ?? accent;

	if (first === undefined) return;

	return [Number(first), Number(accent ?? first)];
}

function effectId(digits: string): string | undefined {
	const id = readNumber(digits, MAX_EFFECT);

	return id ? id.toString() : undefined;
}

/**
 * @description Reads a `#rrggbb` color.
 * @param color The color.
 * @returns The color as a number, or `undefined` when it is not one.
 */
export function parseHex(color: string): number | undefined {
	return /^#[a-fA-F0-9]{6}$/.test(color.trim())
		? Number.parseInt(color.trim().slice(1), 16)
		: undefined;
}

/**
 * @description Hides theme colors and a profile effect in invisible characters to paste at the end of a bio, in the
 * backwards-compatible FPTE format: Vencord's FakeProfileThemes reads the colors, FakeProfileThemesAndEffects both.
 * @param code The colors and effect to hide.
 * @returns A space and the invisible code, or an empty string when there is nothing to hide.
 */
export function encodeProfileCode({ colors, effect }: ProfileCode): string {
	const hiddenColors = colors ? hide(`[${hex(colors[0])},${hex(colors[1])}]`) : '';
	const delimiters = colors ? DELIMITER : DELIMITER + DELIMITER;
	const hiddenEffect = effect ? delimiters + hideNumber(BigInt(effect)) : '';
	const code = hiddenColors + hiddenEffect;

	return code ? ` ${code}` : '';
}

/**
 * @description Finds the theme colors and profile effect a bio hides, in either FPTE format or the older 3y3 one.
 * @param bio The bio.
 * @returns What the bio hides; empty when it hides nothing.
 */
export function decodeProfileCode(bio: string | null | undefined): ProfileCode {
	if (!bio) return {};

	const [first, second, third] = hiddenParts(bio);
	const legacy = legacyColors(first);

	if (legacy) return { colors: legacy, effect: effectId(second) };

	const colors = pairColors(readNumber(first, MAX_COLOR), readNumber(second, MAX_COLOR));

	return { colors, effect: effectId(third) };
}

/**
 * @description Removes the hidden code from a bio, with the space before it, so it does not show as boxes.
 * @param bio The bio.
 * @returns The bio without the hidden characters.
 */
export function stripProfileCode(bio: string): string {
	return bio.replace(/\s?[​\u{E0000}-\u{E0FFF}]+/gu, '');
}
