import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	emojis: setting.boolean({ default: true, title: 'EMOJIS', subtitle: 'EMOJIS_SUBTITLE' }),
	emojiSize: setting.integer({ default: 48, min: 16, max: 160, step: 16, title: 'EMOJI_SIZE' }),
	stickers: setting.boolean({ default: true, title: 'STICKERS', subtitle: 'STICKERS_SUBTITLE' }),
	stickerSize: setting.integer({
		default: 160,
		min: 32,
		max: 320,
		step: 32,
		title: 'STICKER_SIZE',
	}),
	receiveEmojis: setting.boolean({
		default: true,
		title: 'RECEIVE_EMOJIS',
		subtitle: 'RECEIVE_EMOJIS_SUBTITLE',
	}),
	receiveStickers: setting.boolean({
		default: true,
		title: 'RECEIVE_STICKERS',
		subtitle: 'RECEIVE_STICKERS_SUBTITLE',
	}),
	streamQuality: setting.boolean({
		default: true,
		title: 'STREAM_QUALITY',
		subtitle: 'STREAM_QUALITY_SUBTITLE',
	}),
	hyperlinks: setting.boolean({
		default: true,
		title: 'HYPERLINKS',
		subtitle: 'HYPERLINKS_SUBTITLE',
	}),
});
