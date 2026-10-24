export const AVATAR_SIZE = { width: 512, height: 512 };
export const BANNER_SIZE = { width: 1024, height: 256 };

// Profile and guild sheets render their row group inside these sections, which render after the sheet itself.
export const SHEET_SECTIONS = new Set([
	'GuildActionSheetSecondaryActions',
	'UserProfileActionSheetActions',
]);
