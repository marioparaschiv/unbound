import { recordApplied, recordFailure } from '@unbound-plugins/shared/lifecycle/health';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import { settings, type SettingKey } from '@unbound-app/settings';

import { animateDecorations } from '~/decorations';
import { animateNameplates } from '~/nameplates';
import { animateProfileEffects } from '~/profile-effects';
import { animateStickers } from '~/stickers';
import { animateServers } from '~/servers';
import { animateAvatars } from '~/avatars';
import { animateEmojis } from '~/emojis';
import { animateGifs } from '~/gifs';

const FEATURES: Record<SettingKey, () => () => void> = {
	avatars: animateAvatars,
	decorations: animateDecorations,
	nameplates: animateNameplates,
	profileEffects: animateProfileEffects,
	servers: animateServers,
	emojis: animateEmojis,
	stickers: animateStickers,
	gifs: animateGifs,
};

const failures = new Map<SettingKey, string>();

function reportFailures(): void {
	if (failures.size) recordFailure([...failures.values()].join('; '));
}

/**
 * @description Starts one part so a throw only costs that part: the others keep their patches.
 * @param key The setting that gates the part.
 * @param animate Patches the part and returns the function that removes it.
 * @returns The same kind of function, which records the part as applied and as removed.
 */
function isolated(key: SettingKey, animate: () => () => void): () => () => void {
	return () => {
		try {
			const remove = animate();

			failures.delete(key);
			recordApplied(1);
			reportFailures();

			return () => {
				recordApplied(-1);
				remove();
			};
		} catch (error) {
			logger.error(`Failed to animate ${key}:`, error);
			failures.set(key, `${key}: ${error instanceof Error ? error.message : String(error)}`);
			reportFailures();

			return () => {};
		}
	};
}

/**
 * @description Turns each part on while its setting is on, and off again when the user switches it off.
 * Each part patches what its own folder names.
 * @returns A function that removes every part and stops listening; call it in `stop` so the self test counts them out.
 */
export function startAnimate(): () => void {
	failures.clear();

	const stops = (Object.keys(FEATURES) as SettingKey[]).map((key) =>
		whileEnabled(settings, key, true, isolated(key, FEATURES[key])),
	);

	return () => {
		for (const stop of stops.splice(0).reverse()) stop();
	};
}
