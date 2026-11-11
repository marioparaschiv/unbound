import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		greetOnStart: setting.boolean({
			default: true,
			title: 'GREET_ON_START',
			subtitle: 'GREET_ON_START_SUBTITLE',
		}),
		compact: setting.boolean({ default: false, title: 'COMPACT', displayAs: 'checkbox' }),
		opacity: setting.number({ default: 0.5, min: 0, max: 1, step: 0.05, title: 'OPACITY' }),
		size: setting.integer({
			default: 14,
			min: 10,
			max: 24,
			title: 'SIZE',
			visibleWhen: (settings) => settings.greetOnStart && settings.style !== 'compact',
		}),
		retries: setting.integer({ default: 3, min: 0, title: 'RETRIES', displayAs: 'stepper' }),
		limit: setting.number({ default: 100, title: 'LIMIT', disabledWhen: 'compact' }),
		timeout: setting.integer({ default: 30_000, title: 'TIMEOUT', displayAs: 'duration' }),
		nickname: setting.string({ default: 'Wumpus', maxLength: 32, title: 'NICKNAME' }),
		bio: setting.string({ default: '', title: 'BIO', displayAs: 'multiline' }),
		token: setting.string({ default: '', title: 'TOKEN', displayAs: 'secret' }),
		homepage: setting.string({ default: '', title: 'HOMEPAGE', displayAs: 'url' }),
		owner: setting.string({ title: 'OWNER', displayAs: 'user' }),
		style: setting.choice({
			default: 'cozy',
			title: 'STYLE',
			options: {
				cozy: { title: 'STYLE_COZY', subtitle: 'STYLE_COZY_SUBTITLE' },
				compact: 'STYLE_COMPACT',
			},
		}),
		region: setting.choice({
			default: 'eu',
			title: 'REGION',
			options: {
				eu: 'REGION_EU',
				us: 'REGION_US',
				br: 'REGION_BR',
				jp: 'REGION_JP',
				in: 'REGION_IN',
				au: 'REGION_AU',
			},
		}),
		layout: setting.choice({
			default: 'list',
			title: 'LAYOUT',
			displayAs: 'segmented',
			options: { list: 'LAYOUT_LIST', grid: 'LAYOUT_GRID' },
		}),
		tags: setting.array({
			title: 'TAGS',
			of: setting.choice({ options: { a: 'TAG_A', b: 'TAG_B' } }),
		}),
		words: setting.array({ title: 'WORDS', of: setting.string(), maxItems: 10 }),
		friends: setting.array({ title: 'FRIENDS', of: setting.string(), displayAs: 'user' }),
		seen: setting.boolean({ default: false, hidden: true }),
		clearCache: setting.button({
			title: 'CLEAR_CACHE',
			action: 'clearCache',
			displayAs: 'danger',
			confirm: 'CLEAR_CACHE_CONFIRM',
		}),
		appearance: setting.section(
			{ title: 'APPEARANCE', displayAs: 'collapsible' },
			{
				accent: setting.string({ default: '#5865F2', title: 'ACCENT', displayAs: 'color' }),
				badge: setting.string({ default: '#FFFFFF', title: 'BADGE', displayAs: 'color' }),
			},
		),
	},
	{ title: 'GENERAL' },
);
