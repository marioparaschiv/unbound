import type { ApplicationCommand } from '@typings/api/commands';
import { uuid } from '@utilities';


export type * from '@typings/api/commands';


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

export function buildCommands(caller: string, cmds: Omit<ApplicationCommand, '__CALLER__' | '__UNBOUND__'>[]): ApplicationCommand[] {
	if (!caller || typeof caller !== 'string') {
		throw new TypeError('first argument caller must be of type string');
	} else if (!cmds || !Array.isArray(cmds)) {
		throw new TypeError('second argument cmds must be of type array');
	}

	const result: ApplicationCommand[] = [];

	for (const cmd of cmds as ApplicationCommand[]) {
		cmd.type ??= 1;
		cmd.inputType ??= 1;
		cmd.id ??= uuid();
		cmd.applicationId ??= '-1';
		cmd.displayName ??= cmd.name;
		cmd.displayDescription ??= cmd.description;
		cmd.untranslatedName ??= cmd.name;
		cmd.untranslatedDescription ??= cmd.description;


		cmd.__UNBOUND__ = true;
		cmd.__CALLER__ = caller;
		cmd.options = cmd.options?.map(option => ({
			...option,
			displayName: option.name,
			displayDescription: option.description
		}));

		result.push(cmd);
	}

	return result;
}


export function registerCommands(caller: string, cmds: Omit<ApplicationCommand, '__CALLER__' | '__UNBOUND__'>[]): void {
	const toRegister = buildCommands(caller, cmds);

	import('@built-ins/commands').then(({ data }) => data.commands.push(...toRegister));
}

export function unregisterCommands(caller: string): void {
	if (!caller || typeof caller !== 'string') {
		throw new TypeError('first argument caller must be of type string');
	}

	import('@built-ins/commands').then(({ data }) => data.commands = data.commands.filter(c => c.__CALLER__ === caller));
}