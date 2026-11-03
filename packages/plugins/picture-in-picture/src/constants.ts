export const PLUGIN_NAME = 'Picture In Picture';

export const OVERLAY_HEADER_PATH =
	'modules/media_viewer/native/components/overlay/MediaModalOverlayHeader.tsx';
export const OVERLAY_BUTTON_PATH =
	'modules/media_viewer/native/components/overlay/MediaViewerOverlayButton.tsx';

export const OVERLAY_HEADER_EXPORT = 'MediaModalOverlayHeader';
export const OVERLAY_BUTTON_NAMES = ['MediaViewerOverlayButton', 'GIFFavButton'];

export const VIDEO_PROTOTYPE = ['toTypeString', 'stringsOnlyObject'];

export const ICON_NAMES = ['PictureInPictureIcon', 'WindowLaunchIcon', 'ScreenArrowIcon'];

export const START_TIMEOUT_MS = 4_000;

export const HELD_PROPS = { paused: true } as const;
export const ANDROID_SETTLE_MS = 250;

export const ANDROID_TALLEST: readonly [number, number] = [100, 239];
export const ANDROID_WIDEST: readonly [number, number] = [239, 100];
export const ANDROID_MIN_ASPECT = ANDROID_TALLEST[0] / ANDROID_TALLEST[1];
export const ANDROID_MAX_ASPECT = ANDROID_WIDEST[0] / ANDROID_WIDEST[1];
export const ANDROID_DEFAULT_ASPECT: readonly [number, number] = [16, 9];

export const DISCORD_HOST = /(^|\.)(discord\.com|discordapp\.com|discordapp\.net)$/;
export const VIDEO_EXTENSION = /\.(mp4|m4v|mov|webm|mkv)$/i;

export const SETTINGS = {
	loop: true,
} as const;

export type SettingKey = keyof typeof SETTINGS;
