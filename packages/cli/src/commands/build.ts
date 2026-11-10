import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { formatReport, isOverBudget } from '~/lib/report-format';
import type { BuildReport } from '~/rollup/build-report-schema';
import { createCheckCache } from '~/lib/check/check';
import { buildChecks } from '~/lib/build-checks';
import { discoverAddons } from '~/lib/discovery';
import { buildAddon } from '~/lib/build-addon';
import { mapInParallel } from '~/lib/parallel';
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

		const checks = buildChecks(declaredCapabilities);
		const cache = createCheckCache();

		// Each build is its own process, so a few run at once.
		const results = await mapInParallel(addons, async (addon): Promise<BuiltAddonReport> => {
			// Progress goes to stderr, so stdout holds only the reports, or the JSON under `--json`.
			process.stderr.write(
				addon.static ? `Checking ${addon.id} (static addon)…\n` : `Building ${addon.id}…\n`,
			);

			const { ok, report } = await buildAddon(addon, {
				command: resolved.config.build,
				verbose,
				checks,
				cache,
				report: true,
			});
			const passed = ok && !(strictBudget && report && isOverBudget(report));

			if (passed) {
				process.stderr.write(`Built ${addon.id}.\n`);
			} else {
				process.stderr.write(
					ok
						? `Failed to build ${addon.id}: it is over a size budget.\n`
						: `Failed to build ${addon.id}.\n`,
				);
			}

			return { id: addon.id, ok: passed, report: report ?? null };
		});

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
