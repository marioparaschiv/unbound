import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	layout: setting.choice({
		default: 'dynamic',
		hidden: true,
		options: { dynamic: 'LAYOUT_FIT', card: 'LAYOUT_CARD' },
	}),
	radius: setting.number({ default: 16, hidden: true }),
	horizontalPadding: setting.number({ default: 14, hidden: true }),
	verticalPadding: setting.number({ default: 10, hidden: true }),
	spacing: setting.number({ default: 6, hidden: true }),
	opacity: setting.number({ default: 100, hidden: true }),
	mediaCorners: setting.choice({
		default: 'none',
		hidden: true,
		options: {
			none: 'MEDIA_NONE',
			concentric: 'MEDIA_CONCENTRIC',
			flush: 'MEDIA_FLUSH',
			reround: 'MEDIA_REROUND',
		},
	}),
	cornerCurve: setting.choice({
		default: 'continuous',
		hidden: true,
		options: { continuous: 'CURVE_CONTINUOUS', circular: 'CURVE_CIRCULAR' },
	}),
	grouping: setting.choice({
		default: 'grouped',
		hidden: true,
		options: {
			grouped: 'GROUPING_GROUPED',
			separate: 'GROUPING_SEPARATE',
			joined: 'GROUPING_JOINED',
		},
	}),
	roundExposed: setting.boolean({ default: true, hidden: true }),
	roundOuter: setting.boolean({ default: true, hidden: true }),
	joinCurves: setting.boolean({ default: true, hidden: true }),
	smoothSteps: setting.boolean({ default: true, hidden: true }),
	groupSpacing: setting.number({ default: 4, hidden: true }),
	roomyRows: setting.boolean({ default: true, hidden: true }),
	avatarLast: setting.boolean({ default: false, hidden: true }),
	nameInside: setting.boolean({ default: true, hidden: true }),
	reply: setting.choice({
		default: 'auto',
		hidden: true,
		options: { auto: 'REPLY_AUTO', quote: 'REPLY_QUOTE', icon: 'REPLY_ICON' },
	}),
	tail: setting.boolean({ default: false, hidden: true }),
	tailSize: setting.number({ default: 8, hidden: true }),
	color: setting.string({ default: '', hidden: true }),
	ownColor: setting.string({ default: '', hidden: true }),
	mentionColor: setting.string({ default: '', hidden: true }),
	mentionOpacity: setting.number({ default: 40, hidden: true }),
	mentionTint: setting.number({ default: 12, hidden: true }),
	mentionWidth: setting.number({ default: 0.5, hidden: true }),
});
