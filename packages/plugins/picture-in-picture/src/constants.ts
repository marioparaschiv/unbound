export const PLUGIN_NAME = 'Picture In Picture';

export const OVERLAY_HEADER_PATH =
	'modules/media_viewer/native/components/overlay/MediaModalOverlayHeader.tsx';
export const OVERLAY_BUTTON_PATH =
	'modules/media_viewer/native/components/overlay/MediaViewerOverlayButton.tsx';

export const OVERLAY_HEADER_EXPORT = 'MediaModalOverlayHeader';
export const OVERLAY_BUTTON_NAMES = ['MediaViewerOverlayButton', 'GIFFavButton'];

export const ICON_NAMES = ['PictureInPictureIcon', 'WindowLaunchIcon', 'ScreenArrowIcon'];

export const START_TIMEOUT_MS = 4_000;

export const ANDROID_SETTLE_MS = 250;

export const ANDROID_TALLEST: readonly [number, number] = [100, 239];
export const ANDROID_WIDEST: readonly [number, number] = [239, 100];
export const ANDROID_MIN_ASPECT = ANDROID_TALLEST[0] / ANDROID_TALLEST[1];
export const ANDROID_MAX_ASPECT = ANDROID_WIDEST[0] / ANDROID_WIDEST[1];
export const ANDROID_DEFAULT_ASPECT: readonly [number, number] = [16, 9];

export const DISCORD_HOST = /(^|\.)(discord\.com|discordapp\.com|discordapp\.net)$/;
export const VIDEO_EXTENSION = /\.(mp4|m4v|mov|webm|mkv)$/i;

export const IOS_POLL_MS = 250;
export const IOS_WATCH_MS = 1_000;
export const IOS_LAYER_DEPTH = 4;
export const IOS_PORTAL_VIEW = 'DCDPortalView';
export const IOS_VIEW_SEARCH = {
	maxDepth: 128,
	maxVisited: 8_192,
	maxResults: 4,
	attachedOnly: true,
	stopAtMatch: true,
} as const;

export const VIDEO_CONTROLS_PATH = 'modules/media_viewer/native/useVideoControls.tsx';
export const VIDEO_PROTOTYPE = ['toTypeString', 'stringsOnlyObject'];
export const PLAYER_PROGRESS_EVENT = 'MediaPlayerProgress';
export const PROGRESS_FRESH_MS = 3_000;
export const OVERLAY_PATH = 'modules/media_viewer/native/components/overlay/MediaModalOverlay.tsx';
export const WEB_PIP_TIMEOUT_MS = 2_000;
