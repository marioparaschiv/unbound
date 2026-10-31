export const GUILD_ID: string | undefined = '950850315601711176';
export const SITE_URL = 'https://unbound.rip';

export const COLOURS = {
	positive: 0x00_ff_00,
	danger: 0xff_00_00,
	neutral: 0xf1_f1_f1,
	brand: 0xc8_41_51,
	warning: 0xf0_b2_32,
	info: 0x58_65_f2,
	muted: 0x80_84_8e,
	deploy: 0x1a_bc_9c,
} as const;

// `undefined` marks an id the operator has not supplied yet; a dispatcher that requires it is not started.
const IDS = {
	PLUGINS_CHANNEL_ID: '1564067818415333407',
	THEMES_CHANNEL_ID: '1564067819958571110',
	ICON_PACKS_CHANNEL_ID: '1564067821443616768',
	AUDIT_LOG_CHANNEL_ID: '1564277749403746314',
	RELEASES_CHANNEL_ID: '1564277813849100378',
	RELEASES_ROLE_ID: undefined,
	CONTRIBUTOR_ROLE_ID: '967799585844113418',
	ADDON_DEVELOPER_ROLE_ID: '952688684107456612',
	SPONSOR_ROLE_ID: '997233808522874910',
} as const;

export type IdConstantName = keyof typeof IDS;
export type DiscordIds = Readonly<Record<IdConstantName, string | undefined>>;

export const DISCORD_IDS: DiscordIds = IDS;

/**
 * @description Reads an id constant a started dispatcher relies on; the runtime never starts one while it is unset.
 * @param name The id constant.
 * @param ids The id constants to read from.
 * @returns The id; throws when it is unset, which only a dispatcher run outside the runtime can reach.
 */
export function requireId(name: IdConstantName, ids: DiscordIds = DISCORD_IDS): string {
	const id = ids[name];

	if (id === undefined) {
		throw new Error(`${name} is unset in src/lib/constants.ts.`);
	}

	return id;
}

export default { GUILD_ID, SITE_URL, COLOURS, DISCORD_IDS, requireId };
