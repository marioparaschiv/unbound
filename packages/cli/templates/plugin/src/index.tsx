import { startGreeting } from '~/greeting';
import Settings from '~/settings';

export default {
	start() {
		startGreeting();
	},

	getSettingsPanel: () => <Settings />,
};
