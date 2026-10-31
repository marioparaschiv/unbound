import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { patchUserProfileCard } from '~/patches/user-profile-card';
import SettingsPanel from '~/components/settings-panel';
import { notifyNewReviews } from '~/new-reviews';

function start() {
	void notifyNewReviews();

	applyFeatures('ReviewDB', [patchUserProfileCard]);
}

export default {
	start,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
