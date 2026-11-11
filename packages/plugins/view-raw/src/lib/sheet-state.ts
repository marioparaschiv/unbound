import type { RawItem } from '~/lib/raw-items';

type OpenSheet = {
	key: string;
	item: RawItem;
};

/** What the action sheet patch last saw, read by the context menu patch. */
export type SheetState = {
	open: OpenSheet | null;
	profileUserId: string | null;
};

/** The action sheet patch records the open sheet here; the context menu patch reads the last opened profile. */
export const sheetState: SheetState = { open: null, profileUserId: null };
