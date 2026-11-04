export const PLUGIN_NAME = 'Dearrow';

export const BRANDING_URL = 'https://sponsor.ajay.app/api/branding';
export const THUMBNAIL_URL = 'https://dearrow-thumb.ajay.app/api/v1/getThumbnail';

export const SHEET_ROW_KEY = 'unbound-dearrow';

export const REPLACE_MODES = ['all', 'titles', 'thumbnails'] as const;

export type ReplaceMode = (typeof REPLACE_MODES)[number];

export const SETTINGS = {
	showToggle: true,
	replaceElements: 'all' as ReplaceMode,
	dearrowByDefault: true,
};
