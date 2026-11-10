import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import toError from '@unbound-app/utils/to-error';

import { getCredentialsPath, parseEnv } from '~/lib/env';
import { removeCredentials } from '~/lib/credentials';
import { Type } from '~/lib/schema';

const schema = Type.Object({});

const logoutCommand: CommandDefinition<typeof schema> = {
	name: 'logout',
	description: 'Delete the credentials `ubd auth login` stored.',
	summary: 'Delete the stored login.',
	mcp: false,
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
