export const BubbleStyle = {
	radius: 16,
	horizontalPadding: 14,
	verticalPadding: 10,
	/** Points left between the bubbles of two rows, so their backgrounds never overlap. */
	spacing: 6,
	/** Points left between the bubbles of one group; 0 joins them. */
	groupSpacing: 4,
	opacity: 100,
	/** How opaque a mention's outline is, in percent. */
	mentionOpacity: 40,
	/** How far a mention's fill tints towards the mention color, in percent. */
	mentionTint: 12,
	/** How wide a mention's outline is, in points; 0 draws none. */
	mentionWidth: 0.5,
	/** Discord's mention yellow, used while the theme's mention color cannot be read. */
	mentionColor: '#F0B232',
	tailSize: 8,
	/** How much darker than the chat's background the default bubble is, as a share of full lightness. */
	themeShade: 0.08,
	/** The default bubble when the theme's chat background cannot be read: `#222222` on dark themes and `#E9E9EB` on the light theme. */
	dark: { red: 0x22 / 255, green: 0x22 / 255, blue: 0x22 / 255 },
	light: { red: 0xe9 / 255, green: 0xe9 / 255, blue: 0xeb / 255 },
};

export const BubbleLayout = {
	dynamic: 'dynamic',
	card: 'card',
} as const;

export type BubbleLayoutName = (typeof BubbleLayout)[keyof typeof BubbleLayout];

/** How a bubble meets rounded media at its top or bottom edge. */
export const MediaCorners = {
	/** The bubble keeps its own radius. */
	none: 'none',
	/** The bubble's radius grows to the media's plus the padding, so both curves share a centre. */
	concentric: 'concentric',
	/** The bubble's edge meets the media's edge, with the media's radius. */
	flush: 'flush',
	/** The media is rounded again to the bubble's radius less the padding. */
	reround: 'reround',
} as const;

export const CornerCurve = { continuous: 'continuous', circular: 'circular' } as const;

/** `grouped` squares the corners where a group's bubbles meet; `separate` rounds every bubble fully; `joined` makes a group's bubbles touch and read as one shape. */
export const Grouping = { grouped: 'grouped', separate: 'separate', joined: 'joined' } as const;

/** Where a reply's preview sits: `quote` in a box inside the bubble, `icon` above it behind a reply icon, `auto` as `icon` while the avatar sits by a group's last bubble, otherwise `quote`. */
export const ReplyStyle = { auto: 'auto', quote: 'quote', icon: 'icon' } as const;

/** How strongly a translucent bubble blurs what lies behind it, such as a chat background. */
export const BubbleBlur = {
	off: 'off',
	light: 'light',
	medium: 'medium',
	strong: 'strong',
} as const;

/** The blur radius of each `BubbleBlur`, in points. */
export const BLUR_RADIUS = { off: 0, light: 6, medium: 14, strong: 28 };

/** Which bubble of a group points a tail at the avatar. */
export const TailPosition = { off: 'off', first: 'first', last: 'last' } as const;

/** How far a card reaches past its message's content: `tight` to each side while rows keep Discord's height, otherwise `horizontal` and `vertical`. */
export const CardPadding = { tight: 5, horizontal: 10, vertical: 6 };

/** The share of the corner radius a grouped bubble keeps where it meets its neighbour, so the join looks softened, not cut. */
export const SQUARED_CORNER_RATIO = 0.3;

/** Points a joined row grows above and below its content, so a group's lines sit close but clear of the curves where widths change. */
export const JOINED_ROW_ROOM = 4;

/** Points left between the author's name and the timestamp at the bubble's right edge. */
export const NAME_TIME_GAP = 8;

/** The box a reply's preview sits in, inside the bubble between the author's name and the text. */
export const Quote = {
	/** How far the box sits in from the bubble's sides. */
	inset: 6,
	/** The room left and right of the preview. */
	padding: 8,
	/** The space between the name, the box and the text. */
	gap: 4,
	radius: 8,
	/** How much taller a reply's row grows, so the box fits between the name and the text. */
	room: 12,
	/** How much taller a reply's row grows when its preview sits above a bubble holding the name, so it clears the bubble's top padding. */
	above: 8,
	/** How far the box's color is shaded from the bubble's, as a share of full lightness. */
	shade: 0.06,
};

/** The reply icon shown in place of a reply's spine: its size, and the gap left before the preview's avatar, in points. */
export const ReplyIcon = { size: 14, gap: 6 };

export const BubbleLimits = {
	radius: 32,
	padding: 24,
	spacing: 16,
	opacity: 100,
	tailSize: 16,
	mentionWidth: 3,
};

/** The step of the mention outline width slider, in points, so it can draw thinner than one point. */
export const MENTION_WIDTH_STEP = 0.25;

export const IOSClass = {
	messageCell: 'DCDMessageTableViewCell',
	contentView: 'UITableViewCellContentView',
	swipeToReplyView: 'DCDSwipeToReplyView',
	separatorCell: 'DCDSeparatorTableViewCell',
	avatar: 'DCDAvatarView',
	label: 'DCDLabel',
	reactions: 'DCDReactionListView',
	ephemeral: 'DiscordChat.EphemeralView',
	button: 'UIButton',
	mosaic: 'DiscordChat.MediaMosaicView',
	attachment: 'DiscordChat.AttachmentView',
};

export const MEDIA_VIEW_CLASSES = [
	'DiscordChat.MediaMosaicView',
	'DiscordChat.EmbedView',
	'DiscordChat.GuildInviteEmbedView',
	'DiscordChatComponentsSwift.ThumbnailView',
	'DCDMediaView',
	'DiscordChat.AttachmentView',
];

/** The views Discord gives its own rounded corners to inside a message's media. */
export const ROUNDED_MEDIA_CLASSES = ['DiscordChat.MediaMosaicItemLayoutWrapperView'];

export const AndroidClass = {
	accessories: 'com.discord.chat.presentation.message.MessageAccessoriesView',
};

export const CONTENT_COLUMN_SEARCH_DEPTH = 6;
export const CONTENT_COLUMN_WIDTH_RATIO = 3;
export const CONTENT_COLUMN_MINIMUM_WIDTH = 100;
