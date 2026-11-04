import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	avatars: setting.boolean({
		default: true,
		title: 'AVATARS',
		subtitle: 'AVATARS_SUBTITLE',
	}),
	decorations: setting.boolean({
		default: true,
		title: 'DECORATIONS',
		subtitle: 'DECORATIONS_SUBTITLE',
	}),
	nameplates: setting.boolean({
		default: true,
		title: 'NAMEPLATES',
		subtitle: 'NAMEPLATES_SUBTITLE',
	}),
	profileEffects: setting.boolean({
		default: true,
		title: 'PROFILE_EFFECTS',
		subtitle: 'PROFILE_EFFECTS_SUBTITLE',
	}),
	servers: setting.boolean({
		default: true,
		title: 'SERVER_ICONS',
		subtitle: 'SERVER_ICONS_SUBTITLE',
	}),
	emojis: setting.boolean({
		default: true,
		title: 'EMOJIS',
		subtitle: 'EMOJIS_SUBTITLE',
	}),
	stickers: setting.boolean({
		default: true,
		title: 'STICKERS',
		subtitle: 'STICKERS_SUBTITLE',
	}),
	gifs: setting.boolean({
		default: true,
		title: 'GIFS',
		subtitle: 'GIFS_SUBTITLE',
	}),
});
