import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import inspectCommand from '~/commands/inspect';
import installCommand from '~/commands/install';
import migrateCommand from '~/commands/migrate';
import modulesCommand from '~/commands/modules';
import profileCommand from '~/commands/profile';
import publishCommand from '~/commands/publish';
import bridgeCommand from '~/commands/bridge';
import createCommand from '~/commands/create';
import deviceCommand from '~/commands/device';
import logoutCommand from '~/commands/logout';
import reloadCommand from '~/commands/reload';
import statusCommand from '~/commands/status';
import timingCommand from '~/commands/timing';
import buildCommand from '~/commands/build';
import checkCommand from '~/commands/check';
import loginCommand from '~/commands/login';
import routeCommand from '~/commands/route';
import spansCommand from '~/commands/spans';
import traceCommand from '~/commands/trace';
import viewsCommand from '~/commands/views';
import type { TObject } from '~/lib/schema';
import evalCommand from '~/commands/eval';
import hookCommand from '~/commands/hook';
import i18nCommand from '~/commands/i18n';
import logsCommand from '~/commands/logs';
import openCommand from '~/commands/open';
import pushCommand from '~/commands/push';
import devCommand from '~/commands/dev';

// The menu lists commands in this order, so the most-reached-for come first.
/**
 * Every command defined once, from which both surfaces derive: the CLI adapter builds a cleye
 * command per entry, the MCP adapter registers a tool for each entry opted into `surfaces.mcp`.
 */
export const commands: CommandDefinition<TObject>[] = [
	createCommand,
	devCommand,
	buildCommand,
	i18nCommand,
	checkCommand,
	migrateCommand,
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
	profileCommand,
	timingCommand,
];

export default commands;
