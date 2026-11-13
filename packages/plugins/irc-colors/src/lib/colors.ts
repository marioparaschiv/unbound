import { xxHash64 } from '~/lib/xxhash64';

export type ColorOptions = { lightness: number; saturation: number; seed: string };

function hslToRgb(hue: number, saturation: number, lightness: number): number {
	const s = saturation / 100;
	const l = lightness / 100;
	const chroma = s * Math.min(l, 1 - l);
	const channel = (offset: number) => {
		const k = (offset + hue / 30) % 12;

		return Math.round(255 * (l - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
	};

	return (channel(0) << 16) | (channel(8) << 8) | channel(4);
}

/**
 * @description The hue Vencord's IrcColors gives a user: their id and the seed hashed with XXH64, modulo 360.
 * @param userId The user's id.
 * @param seed The seed that shuffles every color.
 * @returns A hue in degrees.
 */
export function userHue(userId: string, seed: string): number {
	return Number(xxHash64(userId + seed) % 360n);
}

/**
 * @description A user's name color as the signed 32-bit opaque ARGB integer Discord's chat rows use.
 * @param userId The user's id.
 * @param options The lightness, saturation and seed to color with.
 * @returns The ARGB color.
 */
export function userArgb(userId: string, { lightness, saturation, seed }: ColorOptions): number {
	return 0xff000000 | hslToRgb(userHue(userId, seed), saturation, lightness);
}
