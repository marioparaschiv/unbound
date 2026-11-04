export type SortOrder = 'highest' | 'lowest';

export const EntryType = {
	Role: 0,
	Member: 1,
	Owner: 2,
} as const;

export type EntryTypeValue = (typeof EntryType)[keyof typeof EntryType];

export const ROW_KEY = 'unbound-permissions-viewer';
export const ROW_ICON = 'ShieldUserIcon';

export const ROLES_CARD_PATH = 'modules/user_profile/native/UserProfileRolesCard.tsx';

export const FALLBACK_ROLE_COLOR = '#99aab5';
export const ALLOWED_COLOR = '#23a55a';
export const DENIED_COLOR = '#f23f43';

// Ids of Discord's own messages for the rows of a user profile's overflow menu: View Main Profile, View Server Profile, Copy Username and Copy User ID.
// The menu carries no user, so its rows' labels, read in the user's language, recognize it.
export const PROFILE_MENU_MESSAGES = ['GISTta', 'DisZzB', 'y5MwJy', 'QvQeLv'];
