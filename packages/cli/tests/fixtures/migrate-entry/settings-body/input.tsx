import Settings from '~/settings';

export default {
	getSettingsPanel() {
		const title = 'Options';

		return <Settings title={title} />;
	},
};
