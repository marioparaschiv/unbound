import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import { storage } from '@unbound-app/api';

import { animateDecorations } from '~/decorations';
import { animateNameplates } from '~/nameplates';
import { animateProfileEffects } from '~/profile-effects';
import { animateStickers } from '~/stickers';
import { animateServers } from '~/servers';
import { animateAvatars } from '~/avatars';
import { animateEmojis } from '~/emojis';
import { animateGifs } from '~/gifs';
import SettingsPanel from '~/settings';
import { PLUGIN_NAME, SETTINGS, type SettingKey } from '~/constants';

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

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	const settings = storage.getBucket();

	dispose = applyFeatures(
		PLUGIN_NAME,
		(Object.keys(FEATURES) as SettingKey[]).map(
			(key) => () => whileEnabled(settings, key, SETTINGS[key], FEATURES[key]),
		),
	);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
