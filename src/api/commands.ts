import type { ApplicationCommand } from '@typings/api/commands';
import { CLIENT_NAME } from '@constants';
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

export const data: {
	section: {
		id: string;
		type: number;
		name: string;
	};
} = {
	section: {
		id: '-3',
		type: 0,
		name: CLIENT_NAME
	}
};

// if (Commands?.BUILT_IN_SECTIONS) {
// 	Commands.BUILT_IN_SECTIONS[data.section.id] = data.section;
// }

export function buildCommands(caller: string, cmds: Omit<ApplicationCommand, '__CALLER__' | '__UNBOUND__'>[]): ApplicationCommand[] {
	if (!caller || typeof caller !== 'string') {
		throw new TypeError('first argument caller must be of type string');
	} else if (!cmds || !Array.isArray(cmds)) {
		throw new TypeError('second argument cmds must be of type array');
	}

	const result: ApplicationCommand[] = [];

	for (const cmd of cmds) {
		result.push({
			type: 1,
			inputType: 1,
			id: uuid(),
			applicationId: '-3',
			// applicationId: data.section.id,
			...cmd,

			name: cmd.name ?? cmd.displayName,
			description: cmd.description ?? cmd.displayDescription,
			displayName: cmd.displayName ?? cmd.name,
			displayDescription: cmd.displayDescription ?? cmd.description,

			__UNBOUND__: true,
			__CALLER__: caller,
			options: cmd.options?.map(option => ({
				...option,
				name: option.name ?? option.displayName,
				description: option.description ?? option.displayDescription,
				displayName: option.displayName ?? option.name,
				displayDescription: option.displayDescription ?? option.description
			})),
		});
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