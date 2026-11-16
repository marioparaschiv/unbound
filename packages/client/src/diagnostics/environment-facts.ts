import type { DebugCardRequest } from '@unbound-app/contracts/debug-cards';

type Environment = NonNullable<DebugCardRequest['environment']>;

const NOISE_BINARY_PARTS = /^(\d+ dylibs|\d+ injected|UUID \S+)$/;
const ALWAYS_TRUE_MARKERS = /^(Developer Mode (on|off)|SELinux enforcing|boot green)$/;
const STANDARD_WEBVIEW =
	/^WebView (com\.google\.android\.webview|com\.android\.webview|com\.android\.chrome) (\d+)$/;
const OLD_WEBVIEW_MAJOR = 120;

function isWorthShowing(marker: string): boolean {
	if (ALWAYS_TRUE_MARKERS.test(marker)) {
		return false;
	}

	const webView = STANDARD_WEBVIEW.exec(marker);

	return !webView || Number(webView[2]) < OLD_WEBVIEW_MAJOR;
}

/**
 * @description Keeps the parts of the loader's environment report that tell installs apart: the binary's build without its
 * dylib count and UUID, and only the markers an ordinary install does not report.
 * @param environment The report, missing on older loaders.
 * @returns The report to send, or `undefined` when there is none.
 */
export function environmentFacts(environment: Environment | undefined): Environment | undefined {
	if (!environment) {
		return undefined;
	}

	const binary = environment.binary
		?.split(' · ')
		.filter((part) => !NOISE_BINARY_PARTS.test(part))
		.join(' · ');

	return {
		...environment,
		...(binary === undefined ? {} : { binary }),
		...(environment.markers ? { markers: environment.markers.filter(isWorthShowing) } : {}),
	};
}
