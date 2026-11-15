import {
	javaBoolean,
	javaFlag,
	javaFloat,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge, NativeJavaReference } from '@unbound-app/api/native';
import { fs } from '@unbound-app/api';

import { downloadSound, toBase64 } from '~/lib/download';
import type { LinkPlayer, PlayOptions } from '~/native/player';

const MAX_PLAYERS = 8;

function fileName(url: string): string {
	let hash = 0;

	for (let index = 0; index < url.length; index++) hash = (hash * 31 + url.charCodeAt(index)) | 0;

	return `sound-${(hash >>> 0).toString(36)}`;
}

/**
 * @description Plays sound files from links on Android with `MediaPlayer`, from copies saved in the plugin's temporary folder.
 * @param native The plugin's native bridge.
 * @param tempPath The plugin's temporary folder, relative to the documents directory.
 * @returns The player.
 */
export function linkPlayerAndroid(native: NativeBridge, tempPath: string): LinkPlayer {
	const { java } = native;
	const players = new Map<number, NativeJavaReference>();
	const saved = new Map<string, string>();
	let next = 1;

	function stop(id: number) {
		const player = players.get(id);

		if (!player) return;

		players.delete(id);

		try {
			java.invoke(player, 'stop', []);
		} finally {
			java.invoke(player, 'release', []);
		}
	}

	function releaseFinished() {
		for (const [id, player] of players) {
			if (!javaFlag(java.invoke(player, 'isPlaying', []))) stop(id);
		}

		while (players.size >= MAX_PLAYERS) stop(players.keys().next().value as number);
	}

	async function localPath(url: string): Promise<string | undefined> {
		const known = saved.get(url);

		if (known) return known;

		const bytes = await downloadSound(url);

		if (!bytes) return undefined;

		const relative = `${tempPath}/${fileName(url)}`;

		await fs.writeFile(relative, toBase64(bytes), 'base64');

		const absolute = `${fs.documentsPath}/${relative}`;

		saved.set(url, absolute);

		return absolute;
	}

	return {
		async play(url: string, { volume, loop }: PlayOptions) {
			const path = await localPath(url);

			if (!path) return undefined;

			releaseFinished();

			const player = java.construct('android.media.MediaPlayer', []);

			java.invoke(player, 'setDataSource', [javaString(path)]);
			java.invoke(player, 'setLooping', [javaBoolean(loop)]);
			java.invoke(player, 'setVolume', [javaFloat(volume), javaFloat(volume)]);
			java.invoke(player, 'prepare', []);
			java.invoke(player, 'start', []);

			const id = next++;

			players.set(id, player);

			return id;
		},
		stop,
		dispose() {
			for (const id of [...players.keys()]) stop(id);
		},
	};
}

export default linkPlayerAndroid;
