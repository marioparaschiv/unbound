import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	serverIcons: setting.boolean({
		default: true,
		title: 'SERVER_ICONS',
		subtitle: 'SERVER_ICONS_SUBTITLE',
	}),
	selectedShape: setting.choice({
		default: 'classic',
		title: 'SELECTED_SHAPE',
		options: { classic: 'SELECTED_CLASSIC', round: 'SELECTED_ROUND' },
		visibleWhen: 'serverIcons',
	}),
	serverBarButtons: setting.boolean({
		default: true,
		title: 'SERVER_BAR_BUTTONS',
		subtitle: 'SERVER_BAR_BUTTONS_SUBTITLE',
	}),
	youBar: setting.boolean({ default: true, title: 'YOU_BAR', subtitle: 'YOU_BAR_SUBTITLE' }),
	chatButtons: setting.boolean({
		default: true,
		title: 'CHAT_BUTTONS',
		subtitle: 'CHAT_BUTTONS_SUBTITLE',
	}),
	chatInput: setting.boolean({
		default: true,
		title: 'CHAT_INPUT',
		subtitle: 'CHAT_INPUT_SUBTITLE',
	}),
	youNav: setting.boolean({ default: true, title: 'YOU_NAV', subtitle: 'YOU_NAV_SUBTITLE' }),
	otherCorners: setting.boolean({
		default: true,
		title: 'OTHER_CORNERS',
		subtitle: 'OTHER_CORNERS_SUBTITLE',
	}),
});
