import { CRASH_CONTEXT_LIMITS } from '@unbound-app/contracts/crash-report-limits';
import type { CrashContext } from '@unbound-app/contracts/crash-reports';

import { currentRoutePath } from '~/diagnostics/current-route';
import { scrubLogLine } from '~/diagnostics/crash-report';

const SNOWFLAKE = /\b\d{15,21}\b/g;

function presentText(value: string | undefined, limit: number): string | undefined {
	return value && !value.startsWith('unknown') ? value.slice(0, limit) : undefined;
}

/**
 * @description Scrubs breadcrumbs for a report: secrets go, and Discord ids become `<id>`, since they can name channels and people.
 * @param breadcrumbs The breadcrumb lines.
 * @returns The newest lines that fit, scrubbed.
 */
export function scrubBreadcrumbs(breadcrumbs: string[]): string[] {
	return breadcrumbs
		.slice(-CRASH_CONTEXT_LIMITS.breadcrumbs)
		.map((line) => scrubLogLine(line).replace(SNOWFLAKE, '<id>').slice(0, 240));
}

type InjectedDetails = { packages: Record<string, string>; versions: Record<string, string> };

function readInjectedDetails(): InjectedDetails {
	try {
		const state = globalThis.NativePlatform?.device.getState?.();

		return { packages: state?.injectedPackages ?? {}, versions: state?.injectedVersions ?? {} };
	} catch {
		return { packages: {}, versions: {} };
	}
}

/**
 * @description Names the package that installed each injected iOS library, or the version of each Android module, so a
 * crash report shows which tweak to blame.
 * @param names The injected library names.
 * @returns The names, as `name (package)` or `name version` where known.
 */
export function withPackages(names: string[] | undefined): string[] | undefined {
	if (!names) {
		return undefined;
	}

	const { packages, versions } = readInjectedDetails();

	return names.map((name) => {
		const owner = packages[name];
		const version = versions[name];

		if (typeof owner === 'string' && owner) {
			return `${name} (${owner})`.slice(0, 120);
		}

		return typeof version === 'string' && version ? `${name} ${version}`.slice(0, 120) : name;
	});
}

/**
 * @description Describes what else was running for a crash report: Discord's build, how it was installed, injected
 * libraries, enabled plugins, Discord's last breadcrumbs and the screen it showed.
 * @param breadcrumbs The breadcrumbs to attach: this launch's, or the previous launch's for a native crash.
 * @returns The context; fields that cannot be read are left out.
 */
export async function crashContext(breadcrumbs: string[]): Promise<CrashContext> {
	const { readDebugInfo } = await import('~/diagnostics/read-debug-info');
	let info: ReturnType<typeof readDebugInfo> | undefined;

	try {
		info = readDebugInfo();
	} catch {
		info = undefined;
	}

	const discordBuild = presentText(info?.discordBuild, 32);
	const installSource = presentText(info?.appSource, 120);
	const injected = withPackages(info?.injected)?.slice(0, CRASH_CONTEXT_LIMITS.injected);
	const addons = info?.enabledPlugins?.slice(0, CRASH_CONTEXT_LIMITS.addons);
	const scrubbed = scrubBreadcrumbs(breadcrumbs);
	const route = (await currentRoutePath())?.slice(0, 120);

	return {
		...(discordBuild ? { discordBuild } : {}),
		...(installSource ? { installSource } : {}),
		...(injected?.length ? { injected } : {}),
		...(addons?.length ? { addons } : {}),
		...(scrubbed.length ? { breadcrumbs: scrubbed } : {}),
		...(route ? { route } : {}),
	};
}
