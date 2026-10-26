export const GUILD_ID = '950850315601711176';
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

// '0' marks an id the operator has not supplied yet; a dispatcher that requires it is not started.
export const PLUGINS_CHANNEL_ID = '1564067818415333407';
export const THEMES_CHANNEL_ID = '1564067819958571110';
export const ICON_PACKS_CHANNEL_ID = '1564067821443616768';
export const AUDIT_LOG_CHANNEL_ID = '1564277749403746314';
export const RELEASES_CHANNEL_ID = '1564277813849100378';
export const RELEASES_ROLE_ID = '0';
export const CONTRIBUTOR_ROLE_ID = '967799585844113418';
export const ADDON_DEVELOPER_ROLE_ID = '952688684107456612';
export const SPONSOR_ROLE_ID = '997233808522874910';

export const DISCORD_IDS = {
	PLUGINS_CHANNEL_ID,
	THEMES_CHANNEL_ID,
	ICON_PACKS_CHANNEL_ID,
	AUDIT_LOG_CHANNEL_ID,
	RELEASES_CHANNEL_ID,
	RELEASES_ROLE_ID,
	CONTRIBUTOR_ROLE_ID,
	ADDON_DEVELOPER_ROLE_ID,
	SPONSOR_ROLE_ID,
} as const;

export type IdConstantName = keyof typeof DISCORD_IDS;

export default {
	GUILD_ID,
	SITE_URL,
	COLOURS,
	PLUGINS_CHANNEL_ID,
	THEMES_CHANNEL_ID,
	ICON_PACKS_CHANNEL_ID,
	AUDIT_LOG_CHANNEL_ID,
	RELEASES_CHANNEL_ID,
	RELEASES_ROLE_ID,
	CONTRIBUTOR_ROLE_ID,
	ADDON_DEVELOPER_ROLE_ID,
	SPONSOR_ROLE_ID,
	DISCORD_IDS,
};
