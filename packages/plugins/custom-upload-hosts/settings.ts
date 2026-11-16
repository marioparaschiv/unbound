import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	host: setting.choice({
		title: 'HOST',
		subtitle: 'HOST_SUBTITLE',
		default: 'catbox',
		options: {
			catbox: { title: 'CATBOX', subtitle: 'CATBOX_SUBTITLE' },
			litterbox: { title: 'LITTERBOX', subtitle: 'LITTERBOX_SUBTITLE' },
			custom: { title: 'CUSTOM', subtitle: 'CUSTOM_SUBTITLE' },
		},
	}),
	litterboxExpiry: setting.choice({
		title: 'EXPIRY',
		default: '24h',
		options: {
			'1h': { title: 'EXPIRY_1H' },
			'12h': { title: 'EXPIRY_12H' },
			'24h': { title: 'EXPIRY_24H' },
			'72h': { title: 'EXPIRY_72H' },
		},
		visibleWhen: (settings: { host: string }) => settings.host === 'litterbox',
	}),
	customUrl: setting.string({
		default: '',
		title: 'CUSTOM_URL',
		subtitle: 'CUSTOM_URL_SUBTITLE',
		displayAs: 'url',
		visibleWhen: (settings: { host: string }) => settings.host === 'custom',
	}),
	customFileField: setting.string({
		default: 'file',
		title: 'CUSTOM_FILE_FIELD',
		subtitle: 'CUSTOM_FILE_FIELD_SUBTITLE',
		visibleWhen: (settings: { host: string }) => settings.host === 'custom',
	}),
	customFields: setting.string({
		default: '',
		title: 'CUSTOM_FIELDS',
		subtitle: 'CUSTOM_FIELDS_SUBTITLE',
		displayAs: 'multiline',
		visibleWhen: (settings: { host: string }) => settings.host === 'custom',
	}),
	customHeaders: setting.string({
		default: '',
		title: 'CUSTOM_HEADERS',
		subtitle: 'CUSTOM_HEADERS_SUBTITLE',
		displayAs: 'multiline',
		visibleWhen: (settings: { host: string }) => settings.host === 'custom',
	}),
	customResponse: setting.choice({
		title: 'CUSTOM_RESPONSE',
		default: 'text',
		options: {
			text: { title: 'RESPONSE_TEXT', subtitle: 'RESPONSE_TEXT_SUBTITLE' },
			json: { title: 'RESPONSE_JSON', subtitle: 'RESPONSE_JSON_SUBTITLE' },
		},
		visibleWhen: (settings: { host: string }) => settings.host === 'custom',
	}),
	customJsonPath: setting.string({
		default: 'url',
		title: 'CUSTOM_JSON_PATH',
		subtitle: 'CUSTOM_JSON_PATH_SUBTITLE',
		visibleWhen: (settings: { host: string; customResponse: string }) =>
			settings.host === 'custom' && settings.customResponse === 'json',
	}),
});
