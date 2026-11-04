import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { patchBurstReactionToggle } from '~/patches/burst-reaction-toggle';
import { limitPlayingEffects } from '~/events/burst-reaction-effect';
import SettingsPanel from '~/components/settings-panel';
import { PLUGIN_NAME, SETTINGS } from '~/constants';
import { settings } from '~/modules';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start() {
	dispose = applyFeatures(PLUGIN_NAME, [
		() =>
			whileEnabled(
				settings,
				'superReactByDefault',
				SETTINGS.superReactByDefault,
				patchBurstReactionToggle,
			),
		limitPlayingEffects,
	]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export const selfTest = featureSelfTest;
export { SettingsPanel };
