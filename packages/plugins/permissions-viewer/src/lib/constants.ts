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
