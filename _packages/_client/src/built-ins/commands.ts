import { type ApplicationCommand, ApplicationCommandType } from '@unbound-app/types/discord/commands.ts';
import { createPatcher, type PatchContext } from '~/api/patcher';
import type { BuiltInData } from '@unbound-app/types/built-ins';
import { buildCommands } from '~/api/commands';
import { Commands } from '~/api/metro/common';
import CoreCommands from '~/commands';


const Patcher = createPatcher('unbound::commands');

export const data: BuiltInData & { commands: ApplicationCommand[]; } = {
	name: 'Commands',
	commands: [...buildCommands('unbound', CoreCommands)]
};

export function start() {
	Patcher.after(Commands, 'getBuiltInCommands', ({ args: [type], result }: PatchContext<[ApplicationCommandType]>) => {
		if (type === ApplicationCommandType.CHAT || (Array.isArray(type) && type.includes(ApplicationCommandType.CHAT))) {
			for (const command of data.commands) {
				if (!result.find(c => c.id === command.id)) {
					result.push(command);
				}
			}
		}

		return result;
	});
}

export function stop() {
	Patcher.unpatchAll();
}