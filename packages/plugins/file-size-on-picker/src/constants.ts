export const PLUGIN_NAME = 'File Size On Picker';

export const BADGE_INSET = 3;

// The units above one byte; a byte count of one unit or less reads in the translated "Bytes".
export const BYTE_UNITS = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

export const BYTE_FORMAT = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 2,
	useGrouping: false,
});
