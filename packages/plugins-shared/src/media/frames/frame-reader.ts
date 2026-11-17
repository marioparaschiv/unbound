import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { createFrameReader as android } from './android/frame-reader';
import { createFrameReader as ios } from './ios/frame-reader';

export type Crop = 'original' | 'square';

export type FrameOptions = { width: number; crop: Crop; caption: string };

export type Frame = { width: number; height: number; rgba: Uint8Array };

export type FrameReader = {
	duration(): number;
	frame(seconds: number, options: FrameOptions): Frame | undefined;
	close(): void;
};

export type FrameReaderFactory = (bridge: NativeBridge, path: string) => FrameReader | undefined;

const createPlatformReader = native.definePlatform({ ios, android });

/**
 * @description Opens a video file to read frames from: Core Image and `AVAssetImageGenerator` on iOS,
 * `MediaMetadataRetriever` on Android.
 * @param bridge The plugin's native bridge.
 * @param path The video's absolute path.
 * @returns The reader, or `undefined` when the platform can't open the video.
 */
export function openFrameReader(bridge: NativeBridge, path: string): FrameReader | undefined {
	return createPlatformReader(bridge, path) ?? undefined;
}

export default { openFrameReader };
