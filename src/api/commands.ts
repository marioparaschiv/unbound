import type { ApplicationCommand } from '@typings/api/commands';
import CoreCommands from '@core/commands';
import { findByProps } from '@api/metro';
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

const Commands = findByProps('getBuiltInCommands', { lazy: true });

export const data = {
	commands: []
};

registerCommands('unbound', CoreCommands);

export function registerCommands(caller: string, cmds: Omit<ApplicationCommand, '__CALLER__' | '__UNBOUND__'>[]): void {
	if (!caller || typeof caller !== 'string') {
		throw new TypeError('first argument caller must be of type string');
	} else if (!cmds || !Array.isArray(cmds)) {
		throw new TypeError('second argument cmds must be of type array');
	}

	for (const command in cmds) {
		const builtInCommands = Commands.getBuiltInCommands([ApplicationCommandType.CHAT], true, false);
		builtInCommands.sort((a, b) => parseInt(b.id) - parseInt(a.id));

		const cmd = cmds[command];

		cmds[command] = {
			displayName: cmd.name,
			displayDescription: cmd.description,
			type: 1,
			inputType: 1,
			id: uuid(),
			applicationId: '-1',
			...cmd,

			__UNBOUND__: true,
			__CALLER__: caller
		} as ApplicationCommand;
	}

	data.commands.push(...cmds);
}

export function unregisterCommands(caller: string): void {
	if (!caller || typeof caller !== 'string') {
		throw new TypeError('first argument caller must be of type string');
	}

	data.commands = data.commands.filter(c => c.__CALLER__ !== caller);
}