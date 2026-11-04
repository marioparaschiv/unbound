export const PLUGIN_NAME = 'Anonymise File Names';

export const METHODS = ['random', 'consistent', 'timestamp'] as const;

export type Method = (typeof METHODS)[number];

export const RANDOM_CHARACTERS = '0123456789bdfhjkmnpqrstvwxz';

export const MIN_RANDOM_LENGTH = 1;
export const MAX_RANDOM_LENGTH = 32;

export const TAR_EXTENSION = /\.tar\.\w+$/;

export const UPLOAD_PREVIEW_SHEET = 'modules/media_uploads/native/UploadPreviewActionSheet.tsx';

export const SHEET_ROW_KEY = 'unbound-anonymise-filenames';

export const SETTINGS = {
	anonymiseByDefault: true,
	method: 'random' as Method,
	randomisedLength: 7,
	consistent: 'image',
};

export type Settings = typeof SETTINGS;
