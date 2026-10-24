import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { getBundleName } from '@unbound-app/contracts/workspace';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { z } from 'zod';

import { resolveAddonTarget } from '~/lib/addon-target';
import { readBuiltAddon } from '~/lib/reload-transport';

const PLUGINS_DIRECTORY = '/data/data/com.discord/files/Unbound/Plugins';
const STAGING_DIRECTORY = '/data/local/tmp';

const schema = z.object({
	addon: z
		.string()
		.default('.')
		.describe('The plugin to install, as its manifest id or directory.'),
	build: z.boolean().default(true).describe('Build the plugin before installing it.'),
	serial: z
		.string()
		.optional()
		.describe('The adb serial of the device, when several are attached.'),
});

function adb(serial: string | undefined, args: string[]) {
	return spawnSync('adb', [...(serial ? ['-s', serial] : []), ...args], { encoding: 'utf8' });
}

const installCommand: CommandDefinition<typeof schema> = {
	name: 'install',
	description:
		"Build one plugin and copy it into Discord's plugin folder on a rooted Android device or " +
		'emulator over adb, so the next cold start loads it. Use `push` to hot-reload instead.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['addon'] },
	async handler({ addon: target, build, serial }) {
		const resolved = await resolveAddonTarget(target, build);

		if ('error' in resolved) {
			return { ok: false, text: resolved.error };
		}

		const { addon } = resolved;
		const { manifest } = readBuiltAddon(addon);
		const files = ['manifest.json', getBundleName(addon.static, manifest.main)];
		const destination = `${PLUGINS_DIRECTORY}/${addon.id}`;

		for (const file of files) {
			const pushed = adb(serial, [
				'push',
				join(addon.output, file),
				`${STAGING_DIRECTORY}/${addon.id}-${file}`,
			]);

			if (pushed.status !== 0) {
				return { ok: false, text: pushed.stderr || pushed.stdout };
			}
		}

		const copy = files
			.map((file) => `cp ${STAGING_DIRECTORY}/${addon.id}-${file} ${destination}/${file}`)
			.join(' && ');
		const script = `mkdir -p ${destination} && ${copy} && chown -R $(stat -c %u:%g ${PLUGINS_DIRECTORY}) ${destination} && chmod 600 ${destination}/*`;
		const installed = adb(serial, ['shell', `su -c '${script}'`]);

		return installed.status === 0
			? {
					ok: true,
					text: `Installed ${addon.id} into ${destination}. Restart Discord to load it.`,
				}
			: { ok: false, text: installed.stderr || installed.stdout };
	},
};

export default installCommand;
