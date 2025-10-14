// TODO: Re-export this in main files
export enum ApplicationCommandType {
	CHAT = 1,
	USER,
	MESSAGE
}

export enum ApplicationCommandInputType {
	BUILT_IN,
	BUILT_IN_TEXT,
	BUILT_IN_INTEGRATION,
	BOT,
	PLACEHOLDER
}

export enum ApplicationCommandOptionType {
	SUB_COMMAND = 1,
	SUB_COMMAND_GROUP,
	STRING = 3,
	INTEGER,
	BOOLEAN,
	USER,
	CHANNEL,
	ROLE,
	MENTIONABLE,
	NUMBER,
	ATTACHMENT
}

export interface ApplicationCommand {
	name: string;
	displayName?: string;
	untranslatedName?: string;

	description: string;
	displayDescription?: string;
	untranslatedDescription?: string;

	inputType?: ApplicationCommandInputType;
	type?: ApplicationCommandType;
	applicationId?: string;
	id?: string;


	options?: ApplicationCommandOption[];
	execute: (args: any[], ctx: ApplicationCommandContext) => ApplicationCommandResult | void | Promise<ApplicationCommandResult> | Promise<void>;
}

export interface ApplicationCommandOption {
	name: string;
	description: string;
	required?: boolean;
	type: ApplicationCommandOptionType;
	displayName: string;
	displayDescription: string;
}

interface ApplicationCommandContext {
	channel: any;
	guild: any;
}

interface ApplicationCommandResult {
	content: string;
	tts?: boolean;
}