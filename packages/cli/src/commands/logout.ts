import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import toError from '@unbound-app/utils/to-error';
import { z } from 'zod';

import { getCredentialsPath, parseEnv } from '~/lib/env';
import { removeCredentials } from '~/lib/credentials';

const schema = z.object({});

const logoutCommand: CommandDefinition<typeof schema> = {
	name: 'logout',
	description: 'Delete the credentials `ubd login` stored.',
	surfaces: { cli: 'root', mcp: false },
	schema,
	async handler() {
		try {
			const path = getCredentialsPath(parseEnv());

			if (!removeCredentials(path)) {
				return { ok: true, text: 'Not logged in.' };
			}

			return { ok: true, text: `Logged out. Deleted ${path}.` };
		} catch (error) {
			return { ok: false, text: toError(error).message };
		}
	},
};

export default logoutCommand;
