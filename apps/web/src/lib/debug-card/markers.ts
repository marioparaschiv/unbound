const ALWAYS_TRUE = /^(Developer Mode (on|off)|SELinux enforcing|boot green)$/;
const STANDARD_WEBVIEW =
	/^WebView (com\.google\.android\.webview|com\.android\.webview|com\.android\.chrome) (\d+)$/;
const OLD_WEBVIEW_MAJOR = 120;

/**
 * @description Leaves out device markers every install of their kind reports, which older loaders still send.
 * @param markers The markers the loader reported.
 * @returns The markers worth showing.
 */
export function shownMarkers(markers: readonly string[]): string[] {
	return markers.filter((marker) => {
		if (ALWAYS_TRUE.test(marker)) {
			return false;
		}

		const webView = STANDARD_WEBVIEW.exec(marker);

		return !webView || Number(webView[2]) < OLD_WEBVIEW_MAJOR;
	});
}
