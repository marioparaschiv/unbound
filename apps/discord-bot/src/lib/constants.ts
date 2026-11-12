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
	plug: { name: 'mb_plug', id: '1570532791886553270' },
	palette: { name: 'mb_palette', id: '1570532796483633262' },
	shapes: { name: 'mb_shapes', id: '1570532801013350440' },
	users: { name: 'mb_users', id: '1570532805530755082' },
	codeCommit: { name: 'mb_code_commit', id: '1570532810371113101' },
	download: { name: 'mb_download', id: '1570532777038712832' },
	globe: { name: 'mb_globe', id: '1570532781791117442' },
	codeBranch: { name: 'mb_code_branch', id: '1570532786706579616' },
} as const satisfies Record<string, AppEmoji>;

export default { COLOURS, EMOJIS };
