#!/usr/bin/env node
import { cli } from 'cleye';

import { mcpCommand, mcpMenuEntry, isMcpTool, runMcpTool } from '~/commands/mcp';
import { toCleyeCommand } from '~/adapters/cleye';
import { renderMenu } from '~/lib/menu';
import { commands } from '~/registry';

const [first, ...rest] = process.argv.slice(2);

if (first === 'mcp' && isMcpTool(rest[0])) {
	runMcpTool(rest);
} else {
	const roots = commands.filter((definition) => definition.surfaces.cli === 'root');
	const argv = cli({ name: 'ubd', commands: [...roots.map(toCleyeCommand), mcpCommand] });

	if (!argv.command && argv._.length === 0 && !argv.flags.help && !argv.flags.version) {
		process.stdout.write(`${renderMenu([...roots, mcpMenuEntry])}\n`);
	}
}
