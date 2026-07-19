#!/usr/bin/env node
import { cli } from 'cleye';

import { toCleyeCommand } from '~/adapters/cleye';
import { mcpCommand } from '~/commands/mcp';
import { renderMenu } from '~/lib/menu';
import { commands } from '~/registry';

const argv = cli({
	name: 'ubd',
	commands: [...commands.map(toCleyeCommand), mcpCommand],
});

if (!argv.command && argv._.length === 0 && !argv.flags.help && !argv.flags.version) {
	process.stdout.write(`${renderMenu()}\n`);
}
