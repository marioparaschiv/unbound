import { setTimeout as sleep } from 'node:timers/promises';
import toError from '@unbound-app/utils/to-error';

import type { DeviceCode } from '~/lib/login';
import { parseEnv } from '~/lib/env';
import { login } from '~/lib/login';

async function handler() {
	try {
		const env = parseEnv();

		if (env.UNBOUND_API_KEY) {
			return {
				ok: true,
				text: 'UNBOUND_API_KEY is set, so ubd uses it and needs no login.',
			};
		}

		const path = await login({ env, delay: sleep, prompt: printCode });

		return { ok: true, text: `Logged in. Credentials stored in ${path}.` };
	} catch (error) {
		return { ok: false, text: toError(error).message };
	}
}

function printCode(code: DeviceCode): void {
	process.stdout.write(
		`Open ${code.verificationUriComplete} and confirm the code ${code.userCode}.\n` +
			`(Or go to ${code.verificationUri} and enter it.)\nWaiting for approval…\n`,
	);
}

export default handler;
