export const GUILD_ID = '1173413947186094080';

export const COLOURS = {
	positive: 0x00_ff_00,
	danger: 0xff_00_00,
	neutral: 0xf1_f1_f1,
	brand: 0xc8_41_51,
} as const;

// '0' marks an id the operator has not supplied yet; startup refuses to run until each is set.
export const PLUGINS_CHANNEL_ID = '0';
export const THEMES_CHANNEL_ID = '0';
export const ICON_PACKS_CHANNEL_ID = '0';
export const AUDIT_LOG_CHANNEL_ID = '0';
export const RELEASES_CHANNEL_ID = '0';
export const RELEASES_ROLE_ID = '0';
export const CONTRIBUTOR_ROLE_ID = '0';
export const ADDON_DEVELOPER_ROLE_ID = '0';
export const SPONSOR_ROLE_ID = '0';

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

export default {
	GUILD_ID,
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
