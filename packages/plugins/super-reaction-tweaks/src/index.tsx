import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { patchBurstReactionToggle } from '~/patches/burst-reaction-toggle';
import { limitPlayingEffects } from '~/events/burst-reaction-effect';
import SettingsPanel from '~/components/settings-panel';
import { SETTINGS } from '~/constants';
import { settings } from '~/modules';

export const { start, stop, selfTest } = runFeatures(
	[
		() =>
			whileEnabled(
				settings,
				'superReactByDefault',
				SETTINGS.superReactByDefault,
				patchBurstReactionToggle,
			),
		limitPlayingEffects,
	],
	{ atomic: true },
);

export { SettingsPanel };
