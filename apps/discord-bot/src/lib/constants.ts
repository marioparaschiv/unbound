export const COLOURS = {
	positive: 0x00_ff_00,
	danger: 0xff_00_00,
	brand: 0xc8_41_51,
	warning: 0xf0_b2_32,
	info: 0x58_65_f2,
	muted: 0x80_84_8e,
	deploy: 0x1a_bc_9c,
} as const;

export type AppEmoji = { name: string; id: string };

/** The bot application's own emojis: Nucleo Micro Bold icons in the brand colour. */
export const EMOJIS = {
	plug: { name: 'mb_plug', id: '1567001632045146202' },
	palette: { name: 'mb_palette', id: '1567001633336856676' },
	shapes: { name: 'mb_shapes', id: '1567001634620440576' },
	users: { name: 'mb_users', id: '1567001635862085702' },
	codeCommit: { name: 'mb_code_commit', id: '1567001636847747074' },
	download: { name: 'mb_download', id: '1567000099467567156' },
	globe: { name: 'mb_globe', id: '1567000100708819019' },
	codeBranch: { name: 'mb_code_branch', id: '1567000101883347026' },
} as const satisfies Record<string, AppEmoji>;

export default { COLOURS, EMOJIS };
