import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { setTimeout as sleep } from 'node:timers/promises';
import toError from '@unbound-app/utils/to-error';
import { z } from 'zod';

import type { DeviceCode } from '~/lib/login';
import { parseEnv } from '~/lib/env';
import { login } from '~/lib/login';

const schema = z.object({});

const loginCommand: CommandDefinition<typeof schema> = {
	name: 'login',
	description:
		'Log in to Unbound by approving a code on the website, so `ubd publish` can submit addons. ' +
		'Not needed in CI when UNBOUND_API_KEY is set.',
	surfaces: { cli: 'root', mcp: false },
	schema,
	async handler() {
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
	},
};

function printCode(code: DeviceCode): void {
	process.stdout.write(
		`Open ${code.verificationUriComplete} and confirm the code ${code.userCode}.\n` +
			`(Or go to ${code.verificationUri} and enter it.)\nWaiting for approval…\n`,
	);
}

export default loginCommand;
