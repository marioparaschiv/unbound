import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { patchUserProfileCard } from '~/patches/user-profile-card';
import SettingsPanel from '~/components/settings-panel';
import { notifyNewReviews } from '~/new-reviews';

export function start() {
	void notifyNewReviews();

	applyFeatures('ReviewDB', [patchUserProfileCard]);
}

export { featureSelfTest as selfTest, SettingsPanel };
