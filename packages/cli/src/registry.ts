import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import type { z } from 'zod';

import installCommand from '~/commands/install';
import modulesCommand from '~/commands/modules';
import publishCommand from '~/commands/publish';
import createCommand from '~/commands/create';
import logoutCommand from '~/commands/logout';
import reloadCommand from '~/commands/reload';
import timingCommand from '~/commands/timing';
import buildCommand from '~/commands/build';
import loginCommand from '~/commands/login';
import routeCommand from '~/commands/route';
import spansCommand from '~/commands/spans';
import traceCommand from '~/commands/trace';
import viewsCommand from '~/commands/views';
import evalCommand from '~/commands/eval';
import hookCommand from '~/commands/hook';
import openCommand from '~/commands/open';
import pushCommand from '~/commands/push';
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
	pushCommand,
	installCommand,
	viewsCommand,
	spansCommand,
	modulesCommand,
	hookCommand,
	traceCommand,
	timingCommand,
	buildCommand,
	devCommand,
	createCommand,
	loginCommand,
	logoutCommand,
	publishCommand,
];

export default commands;
