import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildReportSchema, type BuildReport } from '~/rollup/build-report-schema';
import { BUILD_REPORT_ENV } from '~/rollup/build-report';
import type { DiscoveredAddon } from '~/lib/discovery';
import { parseJson } from '~/lib/parse-json';

export type ReportedBuild = {
	ok: boolean;
	/** The build's report; absent for a static addon, a failed build, or a build without the Unbound preset. */
	report: BuildReport | undefined;
};

function reportPath(addon: DiscoveredAddon) {
	return join(tmpdir(), `ubd-build-report-${process.pid}-${encodeURIComponent(addon.id)}.json`);
}

function readReport(path: string, addon: DiscoveredAddon): BuildReport | undefined {
	if (!existsSync(path)) {
		return void 0;
	}

	const parsed = parseJson(readFileSync(path, 'utf8'), buildReportSchema, 'The build');

	if (!parsed.ok) {
		process.stderr.write(`Failed to read the build report of ${addon.id}: ${parsed.error}\n`);

		return void 0;
	}

	return parsed.value;
}

/**
 * @description Runs a build with {@link BUILD_REPORT_ENV} set, then reads the report the preset wrote.
 * @param addon The addon being built.
 * @param build Runs the build with the given variables added to its environment.
 * @returns Whether the build succeeded, and its report.
 */
export async function buildWithReport(
	addon: DiscoveredAddon,
	build: (env: Record<string, string>) => Promise<boolean>,
): Promise<ReportedBuild> {
	const path = reportPath(addon);

	rmSync(path, { force: true });

	try {
		const ok = await build({ [BUILD_REPORT_ENV]: path });

		return { ok, report: ok ? readReport(path, addon) : void 0 };
	} finally {
		rmSync(path, { force: true });
	}
}

export default buildWithReport;
