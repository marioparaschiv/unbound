import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		showAtSymbol: setting.boolean({
			default: true,
			title: 'SHOW_AT_SYMBOL',
			subtitle: 'SHOW_AT_SYMBOL_SUBTITLE',
		}),
	},
	{ title: 'MENTIONS' },
);
