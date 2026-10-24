export const MESSAGE_LINK_PATTERN =
	/https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/(?:(?:\d{17,20}|@me)\/)?(\d{17,20})\/(\d{17,20})/g;

export const Surface = {
	minWidth: 80,
	minHeight: 72,
	maxHeight: 520,
	bottomTrim: 5,
	settleDelay: 80,
	spacerFontSize: 3,
	topGap: 1,
	background: '#2b2d31',
};

export const CellRetry = {
	limit: 8,
	delay: 120,
};

export const BottomScroll = {
	frame: 16,
	attempts: 12,
};

// The order `layoutMetricsFromNative` reads them in.
export const TABLE_METRICS = [
	'contentSize',
	'contentOffset',
	'bounds',
	'transform',
	'adjustedContentInset',
];

export const SCROLL_STATE = ['isTracking', 'isDragging', 'isDecelerating'];

export const INITIAL_SCAN_DELAYS = [0, 300, 1_500];
export const WINDOW_SCAN_DELAY = 150;
