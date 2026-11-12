import toError from '@unbound-app/utils/to-error';

import { getCredentialsPath, parseEnv } from '~/lib/env';
import { removeCredentials } from '~/lib/credentials';

async function handler() {
	try {
		const path = getCredentialsPath(parseEnv());

		if (!removeCredentials(path)) {
			return { ok: true, text: 'Not logged in.' };
		}

		return { ok: true, text: `Logged out. Deleted ${path}.` };
	} catch (error) {
		return { ok: false, text: toError(error).message };
	}
}

export default handler;
