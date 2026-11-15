import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import type { LinkPlayer } from '~/native/player';
import { overrideFor, readMap } from '~/lib/sounds';

type Sound = { name: string; _volume?: number };

type SoundClass = { prototype: Sound & Record<string, (...args: never[]) => unknown> };

const originalNames = new WeakMap<Sound, string>();
const playing = new WeakMap<Sound, number>();

function overrideOf(sound: Sound) {
	const name = originalNames.get(sound) ?? sound.name;

	return overrideFor(name, readMap(settings.choices), readMap(settings.links));
}

function swapName(sound: Sound) {
	const original = originalNames.get(sound) ?? sound.name;
	const override = overrideFor(original, readMap(settings.choices), readMap(settings.links));
	const name = override?.kind === 'sound' ? override.name : original;

	if (name === sound.name) return;

	originalNames.set(sound, original);
	sound.name = name;
}

function stopLink(player: LinkPlayer, sound: Sound) {
	const id = playing.get(sound);

	if (id === undefined) return;

	playing.delete(sound);
	player.stop(id);
}

function playLink(player: LinkPlayer, sound: Sound, url: string, loop: boolean) {
	stopLink(player, sound);
	void player
		.play(url, { volume: Math.min(1, Math.max(0, sound._volume ?? 1)), loop })
		.then((id) => {
			if (id !== undefined) playing.set(sound, id);
		});
}

/**
 * @description Replaces the sounds Discord plays with another of its sounds or a file from a link, by patching
 * `MobileAudioSound`. A sound Discord already loaded switches the next time Discord creates it.
 * @param player Plays the files from links.
 * @returns Whether `MobileAudioSound` was found.
 */
export function patchSounds(player: LinkPlayer): boolean {
	const module = metro.findByProps('MobileAudioSound') as
		| { MobileAudioSound?: SoundClass }
		| undefined;
	const proto = module?.MobileAudioSound?.prototype;

	if (!proto) {
		logger.warn('Custom sounds skipped: Discord moved MobileAudioSound.');

		return false;
	}

	patcher.before(proto, 'ensureSound', ({ this: sound }) => swapName(sound));

	for (const method of ['play', 'loop', 'playWithListener'] as const) {
		patcher.instead(proto, method, ({ this: sound, args, original }) => {
			const override = overrideOf(sound);

			if (override?.kind !== 'link') {
				swapName(sound);

				return original(...args);
			}

			playLink(player, sound, override.url, method === 'loop');

			return undefined;
		});
	}

	for (const method of ['pause', 'stop'] as const) {
		patcher.before(proto, method, ({ this: sound }) => stopLink(player, sound));
	}

	return true;
}

export default { patchSounds };
