export const AVATAR_SIZE = { width: 512, height: 512 };
export const BANNER_SIZE = { width: 1024, height: 256 };

// Profile and guild sheets render their row group inside these sections, which render after the sheet itself.
export const SHEET_SECTIONS = new Set([
	'GuildActionSheetSecondaryActions',
	'UserProfileActionSheetActions',
]);

// Ids of Discord's own messages for the rows of a user profile's overflow menu: View Main Profile, View Server Profile, Copy Username and Copy User ID.
// The menu carries no user, so its rows' labels, read in the user's language, recognize it.
export const PROFILE_MENU_MESSAGES = ['GISTta', 'DisZzB', 'y5MwJy', 'QvQeLv'];
