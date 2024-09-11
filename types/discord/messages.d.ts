// TODO: Type this

export interface MessageEmbed {

}

export interface MessageAttachment {

}

export interface MessageAuthor {
	id: string;
	username: string;
	discriminator: string;
	avatar: string;
	bot: boolean;
}

export type MessageState = 'SENT' | 'SENDING';

export interface MessageMention {

}

export interface MessageChannelMention {

}

export interface MessageRolesMention {

}

export interface Message {
	content?: string;
	embeds: MessageEmbed[];
	id: string;
	type: number;
	flags: number;
	channel_id: void;
	author: MessageAuthor;
	attachments: MessageAttachment[];
	pinned: boolean;
	mentions: MessageMention[];
	mention_channels: MessageChannelMention[];
	mention_roles: MessageRolesMention[];
	mention_everyone: boolean;
	timestamp: string;
	state: MessageState;
	tts: boolean;
	loggingName: string | void;
};

export interface CreateBotMessagePayload {
	messageId?: string;
	channelId?: string;
	loggingName?: string;
}

type CreateBotMessageResult = Pick<Message,
	'id' |
	'type' |
	'flags' |
	'content' |
	'channel_id' |
	'author' |
	'attachments' |
	'embeds' |
	'pinned' |
	'tts' |
	'mentions' |
	'mention_channels' |
	'mention_roles' |
	'mention_everyone' |
	'state' |
	'timestamp' |
	'loggingName'
>;


export interface ClydeModule {
	// default: [Function: createMessage],
	// userRecordToServer: [Function: userRecordToServer],
	createBotMessage: (payload: CreateBotMessagePayload) => CreateBotMessageResult;
}