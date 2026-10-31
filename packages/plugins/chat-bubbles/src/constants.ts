export const PLUGIN_NAME = 'Chat Bubbles';

export const BubbleStyle = {
	radius: 10,
	horizontalPadding: 8,
	verticalPadding: 4,
	opacity: 40,
	dark: { red: 0, green: 0, blue: 0 },
	light: { red: 1, green: 1, blue: 1 },
};

export const BubbleLimits = {
	radius: 32,
	padding: 24,
	opacity: 100,
};

export const IOSClass = {
	messageCell: 'DCDMessageTableViewCell',
	separatorCell: 'DCDSeparatorTableViewCell',
	avatar: 'DCDAvatarView',
	attributedText: 'DCDAttributedTextView',
	reactions: 'DCDReactionListView',
	ephemeral: 'DiscordChat.EphemeralView',
	button: 'UIButton',
};

export const MEDIA_VIEW_CLASSES = [
	'DiscordChat.MediaMosaicView',
	'DiscordChat.EmbedView',
	'DiscordChatComponentsSwift.ThumbnailView',
	'DCDMediaView',
	'DiscordChat.AttachmentView',
];

export const AndroidClass = {
	messageView: 'com.discord.chat.presentation.message.MessageView',
	accessories: 'com.discord.chat.presentation.message.MessageAccessoriesView',
	content: 'com.discord.chat.presentation.message.view.MessageContentView',
	recycler: 'androidx.recyclerview.widget.RecyclerView',
};

export const CONTENT_COLUMN_SEARCH_DEPTH = 6;
export const CONTENT_COLUMN_WIDTH_RATIO = 3;
export const CONTENT_COLUMN_MINIMUM_WIDTH = 100;
