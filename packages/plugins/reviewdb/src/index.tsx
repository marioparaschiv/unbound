import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';

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
	getSettingsPanel: () => <SettingsPanel />,
};
