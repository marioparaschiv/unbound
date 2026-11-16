import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

import type { LinkPlayer, PlayOptions } from '@unbound-plugins/shared/media/link-player';
import { downloadSound } from '@unbound-plugins/shared/media/sound-download';

/**
 * @description Plays sound files from links on iOS with `AVAudioPlayer`, which mixes with Discord's audio session.
 * @param native The plugin's native bridge.
 * @returns The player.
 */
export function linkPlayerIOS(native: NativeBridge): LinkPlayer {
	const { objc } = native;
	const players = new Map<number, NativeObjectHandle>();
	let next = 1;

	function stop(id: number) {
		const player = players.get(id);

		if (!player) return;

		players.delete(id);
		objc.invoke(player, 'stop', []);
	}

	return {
		async play(url: string, { volume, loop }: PlayOptions) {
			const bytes = await downloadSound(url);

			if (!bytes) return undefined;

			const player = objc.create('AVAudioPlayer', 'initWithData:error:', [
				objc.data(bytes),
				null,
			]) as NativeObjectHandle | null;

			if (!player) return undefined;

			const id = next++;

			objc.invoke(player, 'setVolume:', [volume]);
			objc.invoke(player, 'setNumberOfLoops:', [loop ? -1 : 0]);
			objc.invoke(player, 'play', []);
			players.set(id, player);

			return id;
		},
		stop,
		dispose() {
			for (const id of [...players.keys()]) stop(id);
		},
	};
}

export default linkPlayerIOS;
