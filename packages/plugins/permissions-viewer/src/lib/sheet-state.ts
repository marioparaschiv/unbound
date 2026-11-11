import type { ProfileRecord } from '~/lib/menu-targets';
import type { Target } from '~/lib/sheet-targets';

export type SheetState = {
	open: { key: string; target: Target } | null;
	profile: ProfileRecord | null;
};

/** The open sheet the action sheet patch draws its row into, and the open server profile the profile overflow menu pairs with. */
export const sheetState: SheetState = { open: null, profile: null };
