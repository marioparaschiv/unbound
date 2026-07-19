#!/usr/bin/env bun
import { cli } from 'cleye';

import { toCleyeCommand } from '~/adapters/cleye';
import { mcpCommand } from '~/commands/mcp';
import { commands } from '~/registry';

cli({
	name: 'ubd',
	commands: [...commands.map(toCleyeCommand), mcpCommand],
});
