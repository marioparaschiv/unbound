import { createPatcher } from 'possess';

import type { UnboundCommand } from '~/api/commands';
import { buildCommands } from '~/api/commands';
import { Commands } from '~/api/metro/common';
import { reload } from '~/api/native';

const Patcher = createPatcher('Commands');

export const data = {
	commands: [] as UnboundCommand[],
};

const coreCommands: Omit<UnboundCommand, '__CALLER__' | '__UNBOUND__'>[] = [
	{
		id: 'unbound-reload',
		name: 'reload',
		description: 'Reloads the app',
		execute: () => reload(),
	},
	{
		id: 'unbound-eval',
		name: 'eval',
		description: 'Evaluate JavaScript code',
		options: [
			{
				name: 'code',
				description: 'Code to evaluate',
				type: 3,
				required: true,
			},
		],
		async execute(args: any[]) {
			const code = args.find((x) => x.name === 'code')?.value;
			if (!code) return;

			try {
				const result = eval(code);
				console.log(result);
			} catch (error) {
				console.error('Eval error:', error);
			}
		},
	},
];

export function start() {
	data.commands = buildCommands('unbound', coreCommands);

	Patcher.after(Commands, 'getBuiltInCommands', ({ args, result }) => {
		const [type] = args;

		if (type === 1 || (Array.isArray(type) && type.includes(1))) {
			for (const command of data.commands) {
				if (!result.find((c) => c.id === command.id)) {
					result.push(command);
				}
			}
		}

		return result;
	});
}

export function stop() {
	Patcher.unpatchAll();
	data.commands = [];
}

export default { start, stop };
