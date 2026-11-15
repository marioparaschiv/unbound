export const COLOURS = {
	positive: 0x00_ff_00,
	danger: 0xff_00_00,
	brand: 0xc8_41_51,
	warning: 0xf0_b2_32,
	info: 0x58_65_f2,
	muted: 0x80_84_8e,
	deploy: 0x1a_bc_9c,
} as const;

export type AppEmoji = { name: string; id: string; animated?: boolean };

/** The bot application's own emojis: Nucleo Micro Bold icons in the brand colour, or white where named. */
export const EMOJIS = {
	plug: { name: 'mb_plug', id: '1570532791886553270' },
	palette: { name: 'mb_palette', id: '1570532796483633262' },
	shapes: { name: 'mb_shapes', id: '1570532801013350440' },
	users: { name: 'mb_users', id: '1570532805530755082' },
	codeCommit: { name: 'mb_code_commit', id: '1570532810371113101' },
	download: { name: 'mb_download', id: '1570532777038712832' },
	globe: { name: 'mb_globe', id: '1570532781791117442' },
	codeBranch: { name: 'mb_code_branch', id: '1570532786706579616' },
	heart: { name: 'mb_heart', id: '1571506917833183394' },
	linkWhite: { name: 'mb_link_white', id: '1571498747924582451' },
	msgsWhite: { name: 'mb_msgs_white', id: '1571498746745720882' },
} as const satisfies Record<string, AppEmoji>;

/**
 * The starboard's star per count, tinted to match its post's accent: an outline star at 2 and 3,
 * filled at 4 and 5, two sparkles at 6 and 7, three in full gold from 8.
 */
export const STAR_EMOJIS = {
	2: { name: 'mb_star_2', id: '1571500046200082584' },
	3: { name: 'mb_star_3', id: '1571500047533736056' },
	4: { name: 'mb_star_4', id: '1571500048364212276' },
	5: { name: 'mb_star_5', id: '1571500049689743445' },
	6: { name: 'mb_star_6', id: '1571500051476385844' },
	7: { name: 'mb_star_7', id: '1571500053309165758' },
	8: { name: 'mb_star_8', id: '1571500057344352366' },
} as const satisfies Record<number, AppEmoji>;

export default { COLOURS, EMOJIS, STAR_EMOJIS };
