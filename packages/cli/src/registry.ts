import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import type { z } from 'zod';

import inspectCommand from '~/commands/inspect';
import installCommand from '~/commands/install';
import modulesCommand from '~/commands/modules';
import publishCommand from '~/commands/publish';
import bridgeCommand from '~/commands/bridge';
import createCommand from '~/commands/create';
import deviceCommand from '~/commands/device';
import logoutCommand from '~/commands/logout';
import reloadCommand from '~/commands/reload';
import statusCommand from '~/commands/status';
import timingCommand from '~/commands/timing';
import buildCommand from '~/commands/build';
import loginCommand from '~/commands/login';
import routeCommand from '~/commands/route';
import spansCommand from '~/commands/spans';
import traceCommand from '~/commands/trace';
import viewsCommand from '~/commands/views';
import evalCommand from '~/commands/eval';
import hookCommand from '~/commands/hook';
import logsCommand from '~/commands/logs';
import openCommand from '~/commands/open';
import pushCommand from '~/commands/push';
import devCommand from '~/commands/dev';

// The menu lists commands in this order, so the most-reached-for come first.
/**
 * Every command defined once, from which both surfaces derive: the CLI adapter builds a cleye
 * command per entry, the MCP adapter registers a tool for each entry opted into `surfaces.mcp`.
 */
export const commands: CommandDefinition<z.ZodObject<z.ZodRawShape>>[] = [
	createCommand,
	devCommand,
	buildCommand,
	publishCommand,
	loginCommand,
	logoutCommand,
	evalCommand,
	openCommand,
	routeCommand,
	reloadCommand,
	statusCommand,
	bridgeCommand,
	pushCommand,
	installCommand,
	deviceCommand,
	logsCommand,
	viewsCommand,
	inspectCommand,
	spansCommand,
	modulesCommand,
	hookCommand,
	traceCommand,
	timingCommand,
];

export default commands;
