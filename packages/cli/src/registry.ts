import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import type { z } from 'zod';

import publishCommand from '~/commands/publish';
import createCommand from '~/commands/create';
import logoutCommand from '~/commands/logout';
import reloadCommand from '~/commands/reload';
import buildCommand from '~/commands/build';
import loginCommand from '~/commands/login';
import routeCommand from '~/commands/route';
import evalCommand from '~/commands/eval';
import openCommand from '~/commands/open';
import devCommand from '~/commands/dev';

/**
 * Every command defined once, from which both surfaces derive: the CLI adapter builds a cleye
 * command per entry, the MCP adapter registers a tool for each entry opted into `surfaces.mcp`.
 */
export const commands: CommandDefinition<z.ZodObject<z.ZodRawShape>>[] = [
	evalCommand,
	openCommand,
	routeCommand,
	reloadCommand,
	buildCommand,
	devCommand,
	createCommand,
	loginCommand,
	logoutCommand,
	publishCommand,
];

export default commands;
