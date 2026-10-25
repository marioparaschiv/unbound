export const Button = {
	size: 32,
	gap: 8,
	iconSize: 22,
};

export const Timing = {
	showDelay: 60,
	show: 70,
	hide: 25,
	fadeIn: 160,
	fadeOut: 120,
	keyboardDismissFallback: 350,
};

export const MAX_PREVIEW_URLS = 4;

export const CHANNEL_MESSAGE_DRAFT_TYPE = 0;
export const MESSAGE_ROW_TYPE = 1;

export const TextFields = new Map<string, 'title' | 'description' | 'siteName' | 'type' | 'image'>([
	['og:title', 'title'],
	['twitter:title', 'title'],
	['og:description', 'description'],
	['twitter:description', 'description'],
	['og:site_name', 'siteName'],
	['og:type', 'type'],
	['og:image', 'image'],
	['og:image:url', 'image'],
	['og:image:secure_url', 'image'],
	['twitter:image', 'image'],
]);

export const SizeFields = new Map<string, 'imageWidth' | 'imageHeight'>([
	['og:image:width', 'imageWidth'],
	['twitter:image:width', 'imageWidth'],
	['og:image:height', 'imageHeight'],
	['twitter:image:height', 'imageHeight'],
]);
