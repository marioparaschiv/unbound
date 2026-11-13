import { dialogs, metro, patcher } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import { ENGINES, imageUrlOf, searchUrl, type Engine } from '~/lib/engines';

type ShareAction = { IconComponent?: unknown; label: string; action: () => void };

type ShareOptions = { source?: unknown };

type MediaShareActions = { useMediaShareActions: (...args: unknown[]) => unknown };

const ENGINE_LABELS: Record<Engine, () => string> = {
	google: () => messages.ENGINE_GOOGLE,
	yandex: () => messages.ENGINE_YANDEX,
	saucenao: () => messages.ENGINE_SAUCENAO,
	iqdb: () => messages.ENGINE_IQDB,
	bing: () => messages.ENGINE_BING,
	tineye: () => messages.ENGINE_TINEYE,
	imgops: () => messages.ENGINE_IMGOPS,
};

function open(engine: Engine, imageUrl: string): void {
	metro.api.Linking.openURL(searchUrl(engine, imageUrl)).catch((error: unknown) =>
		logger.error(`Failed to open the ${engine} search for ${imageUrl}:`, error),
	);
}

function search(imageUrl: string): void {
	const chosen = settings.engine as Engine | 'ask';

	if (chosen !== 'ask') {
		open(chosen, imageUrl);

		return;
	}

	dialogs.showDialog({
		title: messages.SEARCH_IMAGE,
		buttons: (Object.keys(ENGINES) as Engine[]).map((engine) => ({
			label: ENGINE_LABELS[engine](),
			variant: 'secondary',
			onPress: () => open(engine, imageUrl),
		})),
		cancel: true,
	});
}

function searchAction(imageUrl: string): ShareAction {
	const chosen = settings.engine as Engine | 'ask';
	const label =
		chosen === 'ask'
			? messages.SEARCH_IMAGE
			: format('SEARCH_WITH', { engine: ENGINE_LABELS[chosen]() });

	return {
		IconComponent: metro.findByProps('MagnifyingGlassIcon')?.MagnifyingGlassIcon,
		label,
		action: () => search(imageUrl),
	};
}

function patchShareActions(module: MediaShareActions): void {
	patcher.after(module, 'useMediaShareActions', ({ args, result }) => {
		const imageUrl = imageUrlOf((args[0] as ShareOptions | undefined)?.source);

		if (!imageUrl || !Array.isArray(result)) return;

		return [...(result as ShareAction[]), searchAction(imageUrl)];
	});
}

/**
 * @description Adds a search action to the media viewer's menu, patching `useMediaShareActions` in every copy of its module as Discord loads them.
 */
export function patchMediaShareActions(): void {
	const byMediaShareActions = metro.filters.byProps('useMediaShareActions');
	const seen = new Set<MediaShareActions>();

	function asMediaShareActions(exports: MediaShareActions & { default?: MediaShareActions }) {
		if (byMediaShareActions(exports, 0)) return exports;
		if (exports.default && byMediaShareActions(exports.default, 0)) return exports.default;
	}

	function load(module: MediaShareActions | undefined) {
		if (!module || seen.has(module)) return;

		seen.add(module);
		patchShareActions(module);
	}

	const loaded: MediaShareActions[] = metro.find(byMediaShareActions, {
		all: true,
		initialize: false,
	});

	for (const module of loaded) load(module);

	metro.onModuleLoad((exports) => load(asMediaShareActions(exports)));
}

export default { patchMediaShareActions };
