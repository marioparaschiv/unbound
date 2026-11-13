import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	doubleTap: setting.choice({
		default: 'discord',
		title: 'DOUBLE_TAP',
		options: {
			discord: 'ACTION_DISCORD',
			replyOrEdit: 'ACTION_REPLY_OR_EDIT',
			reply: 'ACTION_REPLY',
			react: 'ACTION_REACT',
			forward: 'ACTION_FORWARD',
			save: 'ACTION_SAVE',
			copy: 'ACTION_COPY',
			delete: 'ACTION_DELETE',
			nothing: 'ACTION_NOTHING',
		},
	}),
	tripleTap: setting.choice({
		default: 'nothing',
		title: 'TRIPLE_TAP',
		subtitle: 'TRIPLE_TAP_SUBTITLE',
		options: {
			replyOrEdit: 'ACTION_REPLY_OR_EDIT',
			reply: 'ACTION_REPLY',
			react: 'ACTION_REACT',
			forward: 'ACTION_FORWARD',
			save: 'ACTION_SAVE',
			copy: 'ACTION_COPY',
			delete: 'ACTION_DELETE',
			nothing: 'ACTION_NOTHING',
		},
	}),
	swipe: setting.choice({
		default: 'discord',
		title: 'SWIPE',
		subtitle: 'SWIPE_SUBTITLE',
		options: {
			discord: 'ACTION_DISCORD',
			replyOrEdit: 'ACTION_REPLY_OR_EDIT',
			reply: 'ACTION_REPLY',
			react: 'ACTION_REACT',
			forward: 'ACTION_FORWARD',
			save: 'ACTION_SAVE',
			copy: 'ACTION_COPY',
			delete: 'ACTION_DELETE',
			nothing: 'ACTION_NOTHING',
		},
	}),
	reactEmoji: setting.string({
		default: '👍',
		title: 'REACT_EMOJI',
		subtitle: 'REACT_EMOJI_SUBTITLE',
	}),
});
