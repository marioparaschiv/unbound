import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import type { z } from 'zod';

import createCommand from '~/commands/create';
import buildCommand from '~/commands/build';
import evalCommand from '~/commands/eval';
import devCommand from '~/commands/dev';

/**
 * Every command defined once, from which both surfaces derive: the CLI adapter builds a cleye
 * command per entry, the MCP adapter registers a tool for each entry opted into `surfaces.mcp`.
 */
export const commands: CommandDefinition<z.ZodObject<z.ZodRawShape>>[] = [
	evalCommand,
	buildCommand,
	devCommand,
	createCommand,
];

export default commands;
