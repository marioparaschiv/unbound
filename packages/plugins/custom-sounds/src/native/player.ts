import { native } from '@unbound-app/api';

import { linkPlayerAndroid as android } from '~/native/android/player';
import { linkPlayerIOS as ios } from '~/native/ios/player';

export type PlayOptions = { volume: number; loop: boolean };

export type LinkPlayer = {
	play(url: string, options: PlayOptions): Promise<number | undefined>;
	stop(id: number): void;
	dispose(): void;
};

/**
 * @description Plays sound files from links, downloading each once.
 */
export const linkPlayer = native.definePlatform({ ios, android });
