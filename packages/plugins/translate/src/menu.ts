import { assets, metro, patcher, toasts } from '@unbound-app/api';

import { translateText } from '@translate/api';

const Patcher = patcher.createPatcher('unbound.translate');

const TRANSLATE_ROW_KEY = 'unbound-translate';

type MessageLike = {
	id?: string;
	content?: string;
	channel_id?: string;
	channelId?: string;
	[key: string]: unknown;
};

type TreeNode = {
	type?: { name?: string; displayName?: string } | string;
	key?: unknown;
	props?: { children?: unknown; [prop: string]: unknown };
} | null;

function typeName(node: TreeNode): string | null {
	const type = node?.type;
	if (typeof type === 'string') return type;
	return type?.name ?? type?.displayName ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isActionSheetRowGroup(value: unknown): boolean {
	if (!isRecord(value)) return false;
	const node = value as TreeNode;
	if (typeName(node) === 'ActionSheetRowGroup') return true;
	const props = node?.props;
	if (typeof props?.hasIcons !== 'boolean' || !Array.isArray(props.children)) return false;
	return (
		props.children.length > 0 &&
		props.children.every(
			(row) =>
				isRecord(row) &&
				isRecord(row.props) &&
				typeof row.props.label === 'string' &&
				typeof row.props.onPress === 'function',
		)
	);
}

function findInTree(node: unknown, predicate: (node: TreeNode) => boolean, depth = 0): TreeNode {
	if (depth > 15 || !node || typeof node !== 'object') return null;

	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findInTree(child, predicate, depth + 1);
			if (found) return found;
		}
		return null;
	}

	const element = node as TreeNode;
	if (predicate(element)) return element;

	return findInTree(element?.props?.children, predicate, depth + 1);
}

function showError(error: unknown): void {
	toasts.showToast({
		title: 'Translate Error',
		content: error instanceof Error ? error.message : String(error),
	});
}

async function translateMessage(message: MessageLike): Promise<void> {
	const content = typeof message.content === 'string' ? message.content : '';
	if (!content.trim()) {
		toasts.showToast({ title: 'Translate', content: 'Message has no text to translate.' });
		return;
	}

	const translated = await translateText(content);
	const clipboard = metro?.common?.Clipboard;
	if (!clipboard || typeof clipboard.setString !== 'function') {
		toasts.showToast({ title: 'Translate Error', content: 'Clipboard API is unavailable.' });
		return;
	}

	await clipboard.setString(translated);
	toasts.showToast({ title: 'Translated', content: translated });
}

let patchedInstances = new WeakSet<object>();
let patchGeneration = 0;

export function startTranslateMenuPatch(): void {
	if (typeof metro?.findByProps !== 'function') return;
	const generation = ++patchGeneration;

	const sheetsHost = metro.findByProps('openLazy', 'hideActionSheet') as {
		openLazy?: (...args: unknown[]) => unknown;
		hideActionSheet?: (key: string) => void;
	} | null;
	const ActionSheetRow = (metro.findByProps('ActionSheetRow') as { ActionSheetRow?: any } | null)
		?.ActionSheetRow;

	if (!sheetsHost?.openLazy || !ActionSheetRow) return;

	let currentMessage: MessageLike | null = null;
	let currentKey: string | null = null;

	Patcher.before(sheetsHost, 'openLazy', (ctx) => {
		const [componentPromise, key, extra] = ctx.args as [
			Promise<{ default?: unknown }> | undefined,
			unknown,
			{ message?: MessageLike } | undefined,
		];

		if (
			typeof key !== 'string' ||
			!key.endsWith('MessageLongPressActionSheet') ||
			!componentPromise?.then
		)
			return;

		if (extra?.message) currentMessage = extra.message;
		currentKey = key;

		componentPromise
			.then((instance) => {
				if (generation !== patchGeneration || !instance || patchedInstances.has(instance))
					return;
				patchedInstances.add(instance);

				Patcher.after(instance, 'default', ({ result }) => {
					const message = currentMessage;
					if (!message || typeof message.content !== 'string' || !message.content.trim())
						return result;

					const rowGroup = findInTree(result, isActionSheetRowGroup);
					const rows = rowGroup?.props?.children;

					if (!rowGroup?.props || !Array.isArray(rows)) return result;

					if (rows.some((row) => (row as TreeNode)?.key === TRANSLATE_ROW_KEY))
						return result;

					const action = () => {
						if (currentKey) sheetsHost.hideActionSheet?.(currentKey);
						void translateMessage(message).catch(showError);
					};

					const iconId = assets.getIDByName('LanguageIcon') ?? assets.Icons?.LanguageIcon;

					const translateRow = metro.common.React.createElement(ActionSheetRow, {
						key: TRANSLATE_ROW_KEY,
						label: 'Translate',
						icon: iconId
							? metro.common.React.createElement(ActionSheetRow.Icon, {
									source: iconId,
								})
							: undefined,
						onPress: action,
					});

					rows.splice(1, 0, translateRow);
					return result;
				});
			})
			.catch(() => undefined);
	});
}

export function stopTranslateMenuPatch(): void {
	patchGeneration++;
	patchedInstances = new WeakSet<object>();
	Patcher.unpatchAll();
}
