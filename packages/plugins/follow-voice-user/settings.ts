import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	onlyWhenInVoice: setting.boolean({
		default: true,
		title: 'ONLY_IN_VOICE',
		subtitle: 'ONLY_IN_VOICE_SUBTITLE',
	}),
	leaveWithThem: setting.boolean({
		default: false,
		title: 'LEAVE_WITH_THEM',
		subtitle: 'LEAVE_WITH_THEM_SUBTITLE',
	}),
});
