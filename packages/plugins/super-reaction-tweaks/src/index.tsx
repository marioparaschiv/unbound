import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import { settings } from '@unbound-app/settings';

import { patchBurstReactionToggle } from '~/patches/burst-reaction-toggle';
import { limitPlayingEffects } from '~/events/burst-reaction-effect';

export const { start, stop, selfTest } = runFeatures(
	[
		() =>
			whileEnabled(
				settings,
				'superReactByDefault',
				settings.superReactByDefault,
				patchBurstReactionToggle,
			),
		limitPlayingEffects,
	],
	{ atomic: true },
);
