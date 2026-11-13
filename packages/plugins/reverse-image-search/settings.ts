import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	engine: setting.choice({
		default: 'ask',
		title: 'ENGINE',
		options: {
			ask: { title: 'ENGINE_ASK', subtitle: 'ENGINE_ASK_SUBTITLE' },
			google: 'ENGINE_GOOGLE',
			yandex: 'ENGINE_YANDEX',
			saucenao: 'ENGINE_SAUCENAO',
			iqdb: 'ENGINE_IQDB',
			bing: 'ENGINE_BING',
			tineye: 'ENGINE_TINEYE',
			imgops: 'ENGINE_IMGOPS',
		},
	}),
});
