import type { ApplicationCommandType, ApplicationCommandInputType, ApplicationCommandOptionType } from '@api/commands';

export interface ApplicationCommand {
	name: string;
	displayName?: string;

	description: string;
	displayDescription?: string;

	inputType?: ApplicationCommandInputType;
	type?: ApplicationCommandType;
	applicationId?: string;
	__UNBOUND__?: boolean;
	__CALLER__?: string;
	id?: string;


	options?: ApplicationCommandOption[];
	execute: (args: any[], ctx: CommandContext) => CommandResult | void | Promise<CommandResult> | Promise<void>;
}

export interface ApplicationCommandOption {
	name: string;
	description: string;
	required?: boolean;
	type: ApplicationCommandOptionType;
	displayName: string;
	displayDescription: string;
}

interface CommandContext {
	channel: any;
	guild: any;
}

interface CommandResult {
	content: string;
	tts?: boolean;
}
