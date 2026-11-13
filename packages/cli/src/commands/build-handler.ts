import { formatReport, isOverBudget } from '~/lib/report-format';
import type { BuildReport } from '~/rollup/build-report-schema';
import type { CommandHandler } from '~/lib/lazy-handler';
import { createCheckCache } from '~/lib/check/check';
import { buildChecks } from '~/lib/build-checks';
import { discoverAddons } from '~/lib/discovery';
import { buildAddon } from '~/lib/build-addon';
import { mapInParallel } from '~/lib/parallel';
import { loadConfig } from '~/lib/config';

import type buildCommand from './build';

/** One addon in `ubd build --json`: whether it built, and its report when the preset wrote one. */
type BuiltAddonReport = { id: string; ok: boolean; report: BuildReport | null };

const handler: CommandHandler<typeof buildCommand.schema> = async ({
	declaredCapabilities,
	strictBudget,
	verbose,
}) => {
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
};

export default handler;
