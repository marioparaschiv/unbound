/**
 * The variables `ubd` sets on an addon's build command for the Unbound rollup preset to read, since
 * the build runs as the addon's own process. {@link buildEnv} writes them; {@link readBuildEnv} reads them back.
 */

/** Set by `ubd dev` and `ubd push`: components register for hot refresh and keep their hooks' state on push. */
export const HOT_ENV = 'UNBOUND_HOT';

/** Set by `ubd build --verbose`: the build logs each metro filter and locale hook it rewrote. */
export const VERBOSE_ENV = 'UNBOUND_VERBOSE';

/** Where the preset writes the build report as JSON; nothing is written without it. */
export const BUILD_REPORT_ENV = 'UNBOUND_BUILD_REPORT';

export type BuildEnv = {
	hot: boolean;
	verbose: boolean;
	reportFile?: string;
};

/**
 * @description Writes the variables a build command needs for these settings.
 * @param settings Whether the build is hot, verbose, and where its report goes.
 * @returns The variables to add to the build's environment.
 */
export function buildEnv({ hot, verbose, reportFile }: BuildEnv): Record<string, string> {
	return {
		...(hot ? { [HOT_ENV]: '1' } : {}),
		...(verbose ? { [VERBOSE_ENV]: '1' } : {}),
		...(reportFile === void 0 ? {} : { [BUILD_REPORT_ENV]: reportFile }),
	};
}

/**
 * @description Reads the settings `ubd` passed to this build. Inverse of {@link buildEnv}.
 * @param env The environment to read, `process.env` by default.
 * @returns Whether the build is hot, verbose, and where its report goes.
 */
export function readBuildEnv(env: Record<string, string | undefined> = process.env): BuildEnv {
	return {
		hot: env[HOT_ENV] === '1',
		verbose: env[VERBOSE_ENV] === '1',
		reportFile: env[BUILD_REPORT_ENV],
	};
}

export default { HOT_ENV, VERBOSE_ENV, BUILD_REPORT_ENV, buildEnv, readBuildEnv };
