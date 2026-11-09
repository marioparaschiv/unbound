import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { availableParallelism } from 'node:os';

import { BUILD_CHECKS, DECLARED_CAPABILITY_CHECKS, buildWithChecks } from '~/lib/build-checks';
import { formatReport, isOverBudget } from '~/lib/report-format';
import type { BuildReport } from '~/rollup/build-report-schema';
import { buildWithReport } from '~/lib/build-report';
import { discoverAddons } from '~/lib/discovery';
import { defaulted, Type } from '~/lib/schema';
import { loadConfig } from '~/lib/config';

/** One addon in `ubd build --json`: whether it built, and its report when the preset wrote one. */
type BuiltAddonReport = { id: string; ok: boolean; report: BuildReport | null };

const schema = Type.Object({
	declaredCapabilities: defaulted(
		Type.Boolean({
			description:
				'Keep the hand-written platforms and Capabilities of plugins that still declare them, until they select platform code with native.definePlatform.',
		}),
		false,
	),
	strictBudget: defaulted(
		Type.Boolean({
			description:
				'Fail the build when a plugin goes over a size budget, instead of warning.',
		}),
		false,
	),
	verbose: defaulted(
		Type.Boolean({
			description:
				'Also list the largest source modules of each plugin, and log each metro filter the build rewrote into a built-in filter, with its file and line.',
		}),
		false,
	),
});

const buildCommand: CommandDefinition<typeof schema> = {
	name: 'build',
	description:
		"Build every addon in the workspace once, then run the post-build checks on each, reporting per-addon success and failure, and each plugin's size against its budgets.",
	summary: 'Build every addon in the workspace.',
	surfaces: { cli: 'root', mcp: false },
	schema,
	async handler({ declaredCapabilities, strictBudget, verbose }) {
		const resolved = loadConfig();

		if ('error' in resolved) {
			return { ok: false, text: resolved.error };
		}

		const addons = await discoverAddons(resolved);

		if (addons.length === 0) {
			return { ok: true, text: 'No addons found.' };
		}

		const { build } = resolved.config;
		const checks = declaredCapabilities ? DECLARED_CAPABILITY_CHECKS : BUILD_CHECKS;
		const results: BuiltAddonReport[] = [];
		// The rollup preset reads it, since the build runs as the addon's own command.
		const env: Record<string, string> = verbose ? { UNBOUND_VERBOSE: '1' } : {};
		const queue = addons.map((addon, index) => ({ addon, index }));

		// Each build is its own process, so a few run at once; results keep the order of `addons`.
		async function work() {
			for (let next = queue.shift(); next; next = queue.shift()) {
				const { addon, index } = next;

				// Progress goes to stderr, so stdout holds only the reports, or the JSON under `--json`.
				process.stderr.write(
					addon.static
						? `Checking ${addon.id} (static addon)…\n`
						: `Building ${addon.id}…\n`,
				);

				const { ok, report } = await buildWithReport(addon, (reportEnv) =>
					buildWithChecks(addon, build, checks, { ...env, ...reportEnv }),
				);
				const passed = ok && !(strictBudget && report && isOverBudget(report));

				results[index] = { id: addon.id, ok: passed, report: report ?? null };

				if (passed) {
					process.stderr.write(`Built ${addon.id}.\n`);
				} else {
					process.stderr.write(
						ok
							? `Failed to build ${addon.id}: it is over a size budget.\n`
							: `Failed to build ${addon.id}.\n`,
					);
				}
			}
		}

		await Promise.all(
			Array.from({ length: Math.min(addons.length, availableParallelism()) }, work),
		);

		const tables = results.flatMap(({ report }) =>
			report ? [formatReport(report, { verbose, strict: strictBudget })] : [],
		);
		const failed = results.filter((result) => !result.ok).map((result) => result.id);
		const data = { addons: results };

		if (failed.length > 0) {
			return {
				ok: false,
				text: [...tables, `Failed to build: ${failed.join(', ')}.`].join('\n\n'),
				data,
			};
		}

		return { ok: true, text: [...tables, 'All addons built.'].join('\n\n'), data };
	},
};

export default buildCommand;
