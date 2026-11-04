import { findRenderTarget, type RenderTarget } from '@unbound-plugins/shared/react/render-target';
import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { metro, patcher } from '@unbound-app/api';

import { frameScript, readPipResult, requestScript } from '~/picture-in-picture/web/scripts';
import { PLUGIN_NAME, WEB_PIP_TIMEOUT_MS } from '~/constants';

type WebViewHandle = { injectJavaScript?: (script: string) => void };

type WebViewProps = Record<string, unknown> & {
	source?: unknown;
	javaScriptEnabled?: unknown;
	injectedJavaScriptBeforeContentLoaded?: unknown;
	injectedJavaScriptBeforeContentLoadedForMainFrameOnly?: unknown;
	onMessage?: unknown;
};

type Ref<T> = ((value: T | null) => void) | { current: T | null } | null | undefined;

export type WebPlayers = {
	enter(onEnded: () => void): Promise<boolean>;
	leave(): void;
	dispose(): void;
};

function isScript(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isMediaPage(props: WebViewProps): boolean {
	const source = props.source as { uri?: unknown; html?: unknown } | undefined;

	return props.javaScriptEnabled !== false && Boolean(source && (source.uri || source.html));
}

function setRef<T>(ref: Ref<T>, value: T | null) {
	if (typeof ref === 'function') ref(value);
	else if (ref) ref.current = value;
}

function earlyScript(props: WebViewProps): string {
	const existing = props.injectedJavaScriptBeforeContentLoaded;

	if (!isScript(existing)) return frameScript();

	const existingInFrames = props.injectedJavaScriptBeforeContentLoadedForMainFrameOnly === false;
	const kept = existingInFrames ? existing : `if (window === window.top) {\n${existing}\n}`;

	return `${kept}\n;\n${frameScript()}`;
}

function skip(reason: string) {
	console.error(`[${PLUGIN_NAME}] Skipped web players, ${reason}.`);
	recordSkip(reason);
}

function exportKeys(module: AnyProps, target: RenderTarget): string[] {
	if (target.holder !== module) return [target.key];

	return module.default === module.WebView ? ['WebView', 'default'] : ['WebView'];
}

/**
 * @description Lets web players, such as the media viewer's YouTube or TikTok page, open the system picture in picture window for their video. Every `WebView` that shows a page gets a script in each of its frames, and the latest one stays reachable.
 * `enter` asks the page's frames to put their largest video into the window and resolves with whether one did.
 * @returns The web players, with a `dispose` that removes the patch.
 */
export function createWebPlayers(): WebPlayers {
	let latest: WebViewHandle | null = null;
	let pending: ((entered: boolean) => void) | null = null;
	let ended: (() => void) | null = null;

	function settle(entered: boolean) {
		pending?.(entered);
		pending = null;
	}

	function withPip(
		props: WebViewProps,
		ref: Ref<WebViewHandle>,
	): [WebViewProps, Ref<WebViewHandle>] {
		const onMessage = props.onMessage;

		return [
			{
				...props,
				allowsPictureInPictureMediaPlayback: true,
				injectedJavaScriptBeforeContentLoaded: earlyScript(props),
				injectedJavaScriptBeforeContentLoadedForMainFrameOnly: false,
				onMessage: (event: { nativeEvent?: { data?: unknown } }) => {
					const entered = readPipResult(event?.nativeEvent?.data);

					if (entered === undefined) {
						if (typeof onMessage === 'function') onMessage(event);

						return;
					}

					if (entered === 'ended') {
						const notify = ended;

						ended = null;
						notify?.();
					} else if (entered) {
						settle(true);
					}
				},
			},
			(handle: WebViewHandle | null) => {
				if (handle) latest = handle;

				setRef(ref, handle);
			},
		];
	}

	const unpatch = whenLoaded<AnyProps>(
		metro.filters.byProps('WebView'),
		(module) => {
			const target = findRenderTarget(module, 'WebView');

			if (!target) return skip('WebView has no render function');

			if (target.holder[target.key]?.prototype?.isReactComponent) {
				return skip('WebView is a class component');
			}

			const unpatches = exportKeys(module, target).map((key) =>
				patcher.before(target.holder, key, ({ args }) => {
					const [props, ref, ...rest] = args as [
						WebViewProps,
						Ref<WebViewHandle>,
						...unknown[],
					];

					if (!props || !isMediaPage(props)) return;

					return [...withPip(props, ref), ...rest];
				}),
			);

			return () => {
				for (const remove of unpatches) remove();
			};
		},
		{ interop: false },
	);

	return {
		enter(onEnded) {
			const handle = latest;

			if (!handle?.injectJavaScript) return Promise.resolve(false);

			settle(false);

			return new Promise<boolean>((resolve) => {
				const timer = setTimeout(() => settle(false), WEB_PIP_TIMEOUT_MS);

				pending = (entered) => {
					clearTimeout(timer);
					ended = entered ? onEnded : null;
					resolve(entered);
				};
				handle.injectJavaScript?.(requestScript('enter'));
			});
		},
		leave() {
			latest?.injectJavaScript?.(requestScript('leave'));
		},
		dispose() {
			settle(false);
			ended = null;
			unpatch();
			latest = null;
		},
	};
}
