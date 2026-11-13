import { messages } from '@unbound-app/i18n';

export type ToneMeanings = Record<string, () => string>;

export const TONES: ToneMeanings = {
	j: () => messages.TONE_J,
	hj: () => messages.TONE_HJ,
	s: () => messages.TONE_S,
	sarc: () => messages.TONE_SARC,
	srs: () => messages.TONE_SRS,
	nsrs: () => messages.TONE_NSRS,
	lh: () => messages.TONE_LH,
	g: () => messages.TONE_G,
	gen: () => messages.TONE_GEN,
	genq: () => messages.TONE_GENQ,
	gq: () => messages.TONE_GQ,
	rh: () => messages.TONE_RH,
	rhet: () => messages.TONE_RHET,
	rq: () => messages.TONE_RQ,
	pos: () => messages.TONE_POS,
	pc: () => messages.TONE_PC,
	neg: () => messages.TONE_NEG,
	nc: () => messages.TONE_NC,
	neu: () => messages.TONE_NEU,
	nm: () => messages.TONE_NM,
	nbh: () => messages.TONE_NBH,
	nay: () => messages.TONE_NAY,
	ay: () => messages.TONE_AY,
	nsx: () => messages.TONE_NSX,
	sx: () => messages.TONE_SX,
	t: () => messages.TONE_T,
	ref: () => messages.TONE_REF,
	lyr: () => messages.TONE_LYR,
	ly: () => messages.TONE_LY,
	c: () => messages.TONE_C,
	m: () => messages.TONE_M,
	li: () => messages.TONE_LI,
	hyp: () => messages.TONE_HYP,
	f: () => messages.TONE_F,
	th: () => messages.TONE_TH,
	cb: () => messages.TONE_CB,
	ij: () => messages.TONE_IJ,
	ot: () => messages.TONE_OT,
	nf: () => messages.TONE_NF,
	nsb: () => messages.TONE_NSB,
	p: () => messages.TONE_P,
	r: () => messages.TONE_R,
	q: () => messages.TONE_Q,
	u: () => messages.TONE_U,
	x: () => messages.TONE_X,
	info: () => messages.TONE_INFO,
	sbtw: () => messages.TONE_SBTW,
};

export const TONE_TAG = /(?<=^|\s)\/([a-z]{1,6})(?=$|[\s.,!?;:)\]])/giu;

/**
 * @description Reads the user's extra tags, written one per entry as `tag=meaning`.
 * @param entries The entries from the settings.
 * @returns The meanings by lowercase tag; malformed entries are skipped.
 */
export function customTones(entries: readonly string[]): Record<string, string> {
	const tones: Record<string, string> = {};

	for (const entry of entries) {
		const [tag, ...meaning] = entry.split('=');
		const key = tag?.trim().replace(/^\//, '').toLowerCase();
		const text = meaning.join('=').trim();

		if (key && /^[a-z]{1,6}$/.test(key) && text) tones[key] = text;
	}

	return tones;
}

/**
 * @description Finds the meaning of a tone tag, preferring the user's own tags.
 * @param tag The tag without its slash.
 * @param custom The user's tags.
 * @returns The meaning, or `undefined` for an unknown tag.
 */
export function toneMeaning(tag: string, custom: Record<string, string>): string | undefined {
	const key = tag.toLowerCase();

	return custom[key] ?? TONES[key]?.();
}

export default { customTones, toneMeaning };
