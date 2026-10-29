import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { patchUserProfileCard } from '~/patches/user-profile-card';
import SettingsPanel from '~/components/settings-panel';
import { notifyNewReviews } from '~/new-reviews';

let dispose = () => {};

function start() {
	void notifyNewReviews();

	dispose = applyFeatures('ReviewDB', [patchUserProfileCard]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
