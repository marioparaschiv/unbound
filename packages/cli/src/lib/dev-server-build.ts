import { Type, type StaticDecode } from '~/lib/schema';
import { parseJson } from '~/lib/parse-json';

const FETCH_TIMEOUT_MS = 1500;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const devServerBuildSchema = Type.Object({
	revision: Type.String(),
	sourcesChangedAt: Type.Optional(Type.String()),
	served: Type.Optional(Type.String()),
	bundles: Type.Array(
		Type.Object({ file: Type.String(), builtAt: Type.String(), stale: Type.Boolean() }),
	),
});

/** What the dev server's `/__build` reports about the bundles it serves. */
export type DevServerBuild = StaticDecode<typeof devServerBuildSchema>;

/**
 * @description Asks a dev server how current its bundles are, when the device updates from one.
 * @param updateUrl The device's update URL; only `http:` URLs, which a dev server uses, are asked.
 * @returns The server's build report, or `undefined` when the device updates from elsewhere or the server did not answer.
 */
export async function readDevServerBuild(updateUrl: string): Promise<DevServerBuild | undefined> {
	if (!updateUrl.startsWith('http:')) {
		return undefined;
	}

	try {
		const response = await Promise.race([
			fetch(new URL('__build', updateUrl)),
			Bun.sleep(FETCH_TIMEOUT_MS).then(() => undefined),
		]);

		if (!response?.ok) {
			return undefined;
		}

		const parsed = parseJson(await response.text(), devServerBuildSchema, 'The dev server');

		return parsed.ok ? parsed.value : undefined;
	} catch {
		return undefined;
	}
}

function ageOf(iso: string, now: number): string {
	const age = Math.max(0, now - Date.parse(iso));

	if (age >= DAY_MS) {
		return `${Math.floor(age / DAY_MS)} d`;
	}

	if (age >= HOUR_MS) {
		return `${Math.floor(age / HOUR_MS)} h`;
	}

	return `${Math.floor(age / MINUTE_MS)} min`;
}

/**
 * @description Describes the bundle a dev server last served, warning when the client's sources changed after it was built.
 * @param build The server's build report.
 * @param now The current time, in milliseconds.
 * @returns One status line.
 */
export function describeDevServer(build: DevServerBuild, now = Date.now()): string {
	const bundle = build.bundles.find((entry) => entry.file === build.served);

	if (!bundle) {
		return `Dev server: at ${build.revision}, has not served a bundle since it started`;
	}

	const built = `${bundle.file} built ${ageOf(bundle.builtAt, now)} ago`;

	if (!bundle.stale) {
		return `Dev server: serves ${built}, current with the sources`;
	}

	return `Dev server: STALE — serves ${built}, but client sources changed ${ageOf(build.sourcesChangedAt ?? bundle.builtAt, now)} ago; run bun run build:dev in packages/client`;
}
