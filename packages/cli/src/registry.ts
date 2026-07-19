import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import type { z } from 'zod';

import evalCommand from '~/commands/eval';

/**
 * Every command defined once, from which both surfaces derive: the CLI adapter builds a cleye
 * command per entry, the MCP adapter registers a tool for each entry opted into `surfaces.mcp`.
 */
export const commands: CommandDefinition<z.ZodObject<z.ZodRawShape>>[] = [evalCommand];

export default commands;
