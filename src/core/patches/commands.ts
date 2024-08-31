import { ApplicationCommandType, data, type ApplicationCommand } from '@api/commands';
import { createLogger } from '@structures/logger';
import { createPatcher } from '@api/patcher';
import { findByProps } from '@api/metro';

const Patcher = createPatcher('unbound-toasts');
const Logger = createLogger('Core', 'Commands');

export function apply() {
	const Commands = findByProps('getBuiltInCommands');
	if (!Commands || !Commands.getBuiltInCommands) {
		return Logger.error('Failed to find getBuiltInCommands.');
	}

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

export function remove() {
	Patcher.unpatchAll();
}