export const PLUGIN_NAME = 'File Size On Picker';

export const BADGE_INSET = 3;

export const BYTE_UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

export const BYTE_FORMAT = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 2,
	useGrouping: false,
});
