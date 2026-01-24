import uuid from '@unbound-app/utils/uuid';

export interface UnboundCommand {
	id: string;
	name: string;
	description: string;
	displayName?: string;
	displayDescription?: string;
	untranslatedName?: string;
	untranslatedDescription?: string;
	type?: number;
	inputType?: number;
	applicationId?: string;
	execute: (args: any[]) => void | Promise<void>;
	options?: CommandOption[];
	__UNBOUND__?: boolean;
	__CALLER__?: string;
}

export interface CommandOption {
	name: string;
	description: string;
	displayName?: string;
	displayDescription?: string;
	type: number;
	required?: boolean;
}

export function buildCommands(
	caller: string,
	cmds: Omit<UnboundCommand, '__CALLER__' | '__UNBOUND__'>[],
): UnboundCommand[] {
	if (!caller || typeof caller !== 'string') {
		throw new TypeError('first argument caller must be of type string');
	}
	if (!cmds || !Array.isArray(cmds)) {
		throw new TypeError('second argument cmds must be of type array');
	}

	const result: UnboundCommand[] = [];

	for (const cmd of cmds as UnboundCommand[]) {
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
		cmd.options = cmd.options?.map((option) => ({
			...option,
			displayName: option.name,
			displayDescription: option.description,
		}));

		result.push(cmd);
	}

	return result;
}

export function registerCommands(
	caller: string,
	cmds: Omit<UnboundCommand, '__CALLER__' | '__UNBOUND__'>[],
): void {
	const toRegister = buildCommands(caller, cmds);

	import('~/builtins/commands').then(({ data }) => data.commands.push(...toRegister));
}

export function unregisterCommands(caller: string): void {
	if (!caller || typeof caller !== 'string') {
		throw new TypeError('first argument caller must be of type string');
	}

	import('~/builtins/commands').then(
		({ data }) => (data.commands = data.commands.filter((c) => c.__CALLER__ !== caller)),
	);
}
