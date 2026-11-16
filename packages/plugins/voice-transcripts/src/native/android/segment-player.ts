import type { NativeBridge } from '@unbound-app/api/native';

import type { SegmentPlayer } from '~/native/segment-player';

/**
 * @description Android's speech recognizer reports no word times, so there are no passages to seek to and no player.
 * @param _native The plugin's native bridge.
 * @param _path The downloaded audio's path.
 * @returns Nothing.
 */
export function createSegmentPlayer(
	_native: NativeBridge,
	_path: string,
): SegmentPlayer | undefined {
	return undefined;
}

export default { createSegmentPlayer };
