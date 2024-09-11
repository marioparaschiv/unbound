import { ApplicationCommandType, buildCommands, type ApplicationCommand } from '@api/commands';
import type { BuiltInData } from '@typings/built-ins';
import { createPatcher } from '@api/patcher';
import { Commands } from '@api/metro/common';
import CoreCommands from '@commands';

const Patcher = createPatcher('unbound::commands');

export const data: BuiltInData & { commands: ApplicationCommand[]; } = {
	name: 'Commands',
	commands: [...buildCommands('unbound', CoreCommands)]
};

export function start() {
	Patcher.after(Commands, 'getBuiltInCommands', (_, [type], res: ApplicationCommand[]) => {
		if (type === ApplicationCommandType.CHAT || (Array.isArray(type) && type.includes(ApplicationCommandType.CHAT))) {
			for (const command of data.commands) {
				if (!res.find(c => c.id === command.id)) {
					res.push(command);
				}
			}
		}

		return res;
	});
}

export function stop() {
	Patcher.unpatchAll();
}