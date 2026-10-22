import { metro, patcher, toasts } from '@unbound-app/api';

const PLUGIN_ID = 'unbound.expression-tools';
const ACTION_ROW_KEY = `${PLUGIN_ID}-action`;
const SHEET_KEY_PREFIX = `${PLUGIN_ID}-sheet-`;

type ExpressionKind = 'emoji' | 'sticker';

type Expression = {
	animated: boolean;
	description: string;
	formatType: number | null;
	id: string;
	kind: ExpressionKind;
	name: string;
	tags: string;
};

type Guild = {
	icon?: string | null;
	id: string;
	name: string;
	ownerId?: string;
};

type DesignModule = {
	ActionSheet?: any;
	TextField?: any;
};

type SheetHost = {
	hideActionSheet?: (key: string) => void;
	openLazy?: (component: Promise<{ default: any }>, key: string, options?: object) => void;
};

let unpatches: Array<() => void> = [];
let patchedSheets = new WeakSet<object>();
let patchedOuterSheets = new WeakSet<object>();
let patchedDetailSheets = new WeakSet<object>();
let lifecycle = 0;

function getDesignModule(): DesignModule | null {
	const discord = (metro.components as { Discord?: DesignModule }).Discord;
	if (discord?.ActionSheet) return discord;

	return metro.findByProps('ActionSheet') as DesignModule | null;
}

function getSheets(): SheetHost | null {
	return metro.findByProps('openLazy', 'hideActionSheet') as SheetHost | null;
}

function showError(error: unknown): void {
	const record =
		error && typeof error === 'object'
			? (error as { body?: { message?: unknown }; message?: unknown; text?: unknown })
			: null;
	const message =
		error instanceof Error
			? error.message
			: typeof record?.body?.message === 'string'
				? record.body.message
				: typeof record?.message === 'string'
					? record.message
					: typeof record?.text === 'string'
						? record.text
						: 'The operation could not be completed.';
	toasts.showToast({
		title: 'Expression Tools',
		content: message,
	});
}

function showToast(content: string): void {
	toasts.showToast({ title: 'Expression Tools', content });
}

function findValue(
	value: unknown,
	predicate: (candidate: Record<string, unknown>) => boolean,
	depth = 0,
): Record<string, unknown> | null {
	if (depth > 8 || !value || typeof value !== 'object') return null;
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findValue(item, predicate, depth + 1);
			if (found) return found;
		}
		return null;
	}

	const candidate = value as Record<string, unknown>;
	if (predicate(candidate)) return candidate;
	for (const child of Object.values(candidate)) {
		const found = findValue(child, predicate, depth + 1);
		if (found) return found;
	}
	return null;
}

function getTypeName(value: unknown): string | null {
	if (!value || typeof value !== 'object') return null;
	const type = (value as { type?: { displayName?: string; name?: string } | string }).type;
	if (typeof type === 'string') return type;
	return type?.displayName ?? type?.name ?? null;
}

function findElement(
	value: unknown,
	predicate: (element: { props?: Record<string, unknown>; type?: unknown }) => boolean,
	depth = 0,
): { props?: Record<string, unknown>; type?: unknown } | null {
	if (depth > 12 || !value || typeof value !== 'object') return null;
	if (Array.isArray(value)) {
		for (const child of value) {
			const found = findElement(child, predicate, depth + 1);
			if (found) return found;
		}
		return null;
	}

	const element = value as { props?: Record<string, unknown>; type?: unknown };
	if (predicate(element)) return element;
	return findElement(element.props?.children, predicate, depth + 1);
}

function findChildArray(value: unknown, depth = 0): any[] | null {
	if (depth > 12 || !value || typeof value !== 'object') return null;
	if (Array.isArray(value)) return value;

	const element = value as { props?: { children?: unknown } };
	const children = element.props?.children;
	if (Array.isArray(children)) return children;
	return findChildArray(children, depth + 1);
}

function parseEmoji(props: unknown): Expression | null {
	const record = props as {
		emoji?: Record<string, unknown>;
		emojiNode?: Record<string, unknown>;
	} | null;
	const emoji = record?.emoji;
	const emojiNode = record?.emojiNode;
	const source = typeof emojiNode?.src === 'string' ? emojiNode.src : '';
	const sourceMatch = /\/emojis\/(\d+)\.(gif|png|webp)/.exec(source);
	const id = typeof emoji?.id === 'string' ? emoji.id : sourceMatch?.[1];
	if (!id) return null;

	const name =
		typeof emoji?.name === 'string'
			? emoji.name
			: typeof emojiNode?.alt === 'string'
				? emojiNode.alt.replace(/:/g, '')
				: 'emoji';
	const animated = emoji?.animated === true || sourceMatch?.[2] === 'gif';

	return { animated, description: '', formatType: null, id, kind: 'emoji', name, tags: '' };
}

function parseSticker(props: unknown): Expression | null {
	const sticker = findValue(
		props,
		(candidate) =>
			typeof candidate.id === 'string' && typeof candidate.format_type === 'number',
	);
	if (!sticker || typeof sticker.id !== 'string') return null;

	return {
		animated: sticker.format_type === 2 || sticker.format_type === 3,
		description: typeof sticker.description === 'string' ? sticker.description : '',
		formatType: typeof sticker.format_type === 'number' ? sticker.format_type : null,
		id: sticker.id,
		kind: 'sticker',
		name: typeof sticker.name === 'string' ? sticker.name : 'sticker',
		tags:
			typeof sticker.tags === 'string'
				? sticker.tags
				: typeof sticker.name === 'string'
					? sticker.name
					: 'sticker',
	};
}

function getExpression(kind: ExpressionKind, props: unknown): Expression | null {
	return kind === 'emoji' ? parseEmoji(props) : parseSticker(props);
}

function getAssetUrl(expression: Expression): string {
	if (expression.kind === 'emoji') {
		const extension = expression.animated ? 'gif' : 'png';
		return `https://cdn.discordapp.com/emojis/${expression.id}.${extension}?size=160&quality=lossless`;
	}

	const extension =
		expression.formatType === 3 ? 'json' : expression.formatType === 4 ? 'gif' : 'png';
	return `https://media.discordapp.net/stickers/${expression.id}.${extension}?size=160&quality=lossless`;
}

function getExpressionLink(expression: Expression): string {
	return expression.kind === 'emoji'
		? getAssetUrl(expression)
		: `https://discord.com/stickers/${expression.id}`;
}

function getStickerUploadFile(expression: Expression, name: string): Blob {
	const extension =
		expression.formatType === 3 ? 'json' : expression.formatType === 4 ? 'gif' : 'png';
	const type =
		extension === 'json' ? 'application/json' : extension === 'gif' ? 'image/gif' : 'image/png';
	return {
		name: `${name}.${extension}`,
		type,
		uri: `https://cdn.discordapp.com/stickers/${expression.id}.${extension}`,
	} as unknown as Blob;
}

function getMarkup(expression: Expression): string {
	if (expression.kind === 'emoji')
		return `<${expression.animated ? 'a' : ''}:${expression.name}:${expression.id}>`;
	return getExpressionLink(expression);
}

function copyText(text: string, confirmation: string): void {
	const clipboard = metro.common.Clipboard as
		| { setString?: (value: string) => Promise<void> | void }
		| undefined;
	if (typeof clipboard?.setString !== 'function')
		throw new Error('Clipboard access is unavailable on this client build.');
	void Promise.resolve(clipboard.setString(text))
		.then(() => showToast(confirmation))
		.catch(showError);
}

function getOwnedGuilds(): Guild[] {
	const guildStore = metro.findStore('Guild') as {
		getGuilds?: () => Record<string, Guild>;
	} | null;
	const userStore = metro.findByProps('getCurrentUser', 'getUser') as {
		getCurrentUser?: () => { id?: string } | null;
	} | null;
	const currentUserId = userStore?.getCurrentUser?.()?.id;
	if (!currentUserId) return [];

	return Object.values(guildStore?.getGuilds?.() ?? {})
		.filter((guild) => guild.ownerId === currentUserId)
		.sort((first, second) => first.name.localeCompare(second.name));
}

async function getDataUrl(expression: Expression): Promise<string> {
	const response = await fetch(getAssetUrl(expression));
	if (!response.ok) throw new Error(`Could not fetch ${expression.name}.`);
	const blob = await response.blob();
	const reader = new FileReader();
	return await new Promise<string>((resolve, reject) => {
		reader.onerror = () =>
			reject(reader.error ?? new Error('Could not read the expression file.'));
		reader.onload = () => resolve(String(reader.result));
		reader.readAsDataURL(blob);
	});
}

async function cloneExpression(expression: Expression, guild: Guild, name: string): Promise<void> {
	if (expression.kind === 'emoji') {
		const emojiActions = metro.findByProps('uploadEmoji') as {
			uploadEmoji?: (options: object) => Promise<unknown>;
		} | null;
		if (typeof emojiActions?.uploadEmoji !== 'function')
			throw new Error('Emoji uploads are unavailable on this client build.');
		await emojiActions.uploadEmoji({
			guildId: guild.id,
			image: await getDataUrl(expression),
			name,
		});
	} else {
		const auth = metro.findByProps('getToken') as { getToken?: () => string | null } | null;
		const token = auth?.getToken?.();
		if (!token) throw new Error('Sticker uploads are unavailable on this client build.');
		const form = new FormData();
		form.append('name', name);
		form.append('tags', expression.tags || name);
		form.append('description', expression.description);
		form.append('file', getStickerUploadFile(expression, name));
		const body = await new Promise<Record<string, unknown>>((resolve, reject) => {
			const request = new XMLHttpRequest();
			request.open('POST', `https://discord.com/api/v10/guilds/${guild.id}/stickers`);
			request.setRequestHeader('Authorization', token);
			request.onerror = () => reject(new Error('Sticker upload failed.'));
			request.onload = () => {
				let payload: Record<string, unknown>;
				try {
					payload = JSON.parse(request.responseText) as Record<string, unknown>;
				} catch {
					reject(new Error('Sticker upload returned an invalid response.'));
					return;
				}
				if (request.status >= 200 && request.status < 300) {
					resolve(payload);
					return;
				}
				reject({ body: payload });
			};
			request.send(form);
		});
		const dispatcher = metro.findByProps('dispatch', 'subscribe') as {
			dispatch?: (event: object) => void;
		} | null;
		const userStore = metro.findByProps('getCurrentUser', 'getUser') as {
			getCurrentUser?: () => object | null;
		} | null;
		if (body && typeof dispatcher?.dispatch === 'function')
			dispatcher.dispatch({
				guildId: guild.id,
				sticker: { ...body, user: userStore?.getCurrentUser?.() },
				type: 'GUILD_STICKERS_CREATE_SUCCESS',
			});
	}

	showToast(`Cloned ${expression.name} to ${guild.name}.`);
}

function isFavoriteSticker(expression: Expression): boolean {
	if (expression.kind !== 'sticker') return false;
	const stickers = metro.findByProps('isFavoriteSticker') as {
		isFavoriteSticker?: (id: string) => boolean;
	} | null;
	return stickers?.isFavoriteSticker?.(expression.id) === true;
}

async function toggleFavoriteSticker(expression: Expression, favorite: boolean): Promise<void> {
	const actions = metro.findByProps('favoriteSticker', 'unfavoriteSticker') as {
		favoriteSticker?: (id: string) => Promise<unknown>;
		unfavoriteSticker?: (id: string) => Promise<unknown>;
	} | null;
	const action = favorite ? actions?.favoriteSticker : actions?.unfavoriteSticker;
	if (typeof action !== 'function')
		throw new Error('Favorites are unavailable on this client build.');
	await action(expression.id);
	showToast(
		favorite
			? `${expression.name} added to favorites.`
			: `${expression.name} removed from favorites.`,
	);
}

function CloneSheet({ expression, onClose }: { expression: Expression; onClose: () => void }) {
	const React = metro.common.React;
	const ReactNative = metro.common.ReactNative;
	const Discord = getDesignModule();
	const [name, setName] = React.useState(expression.name);
	const [query, setQuery] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const guilds = React.useMemo(() => getOwnedGuilds(), []);
	const visibleGuilds = React.useMemo(
		() =>
			guilds.filter((guild) => guild.name.toLowerCase().includes(query.trim().toLowerCase())),
		[guilds, query],
	);

	if (!Discord?.ActionSheet || !Discord.TextField) {
		return (
			<ReactNative.View style={{ padding: 16 }}>
				<ReactNative.Text>Cloning is unavailable on this client build.</ReactNative.Text>
			</ReactNative.View>
		);
	}

	return (
		<Discord.ActionSheet>
			<ReactNative.View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
				<ReactNative.View
					style={{ alignItems: 'center', flexDirection: 'row', marginBottom: 16 }}
				>
					<ReactNative.Image
						source={{ uri: getAssetUrl(expression) }}
						style={{ borderRadius: 12, height: 48, marginRight: 12, width: 48 }}
					/>
					<ReactNative.View style={{ flex: 1 }}>
						<ReactNative.Text
							style={{ color: '#f2f3f5', fontSize: 18, fontWeight: '700' }}
						>
							Clone to a server
						</ReactNative.Text>
						<ReactNative.Text
							numberOfLines={1}
							style={{ color: '#b5bac1', fontSize: 13, marginTop: 2 }}
						>
							{expression.name}
						</ReactNative.Text>
					</ReactNative.View>
				</ReactNative.View>
				<ReactNative.Text
					style={{ color: '#b5bac1', fontSize: 12, fontWeight: '600', marginBottom: 7 }}
				>
					NAME
				</ReactNative.Text>
				<Discord.TextField value={name} onChange={setName} placeholder='Expression name' />
				<ReactNative.Text
					style={{
						color: '#b5bac1',
						fontSize: 12,
						fontWeight: '600',
						marginBottom: 7,
						marginTop: 16,
					}}
				>
					YOUR SERVERS
				</ReactNative.Text>
				<Discord.TextField
					value={query}
					onChange={setQuery}
					placeholder='Search servers'
					isClearable
				/>
				<ReactNative.View style={{ gap: 8, marginTop: 12 }}>
					{visibleGuilds.map((guild) => (
						<ReactNative.Pressable
							key={guild.id}
							disabled={busy || !name.trim()}
							onPress={() => {
								if (busy || !name.trim()) return;
								setBusy(true);
								onClose();
								void cloneExpression(expression, guild, name.trim())
									.catch(showError)
									.finally(() => setBusy(false));
							}}
							style={({ pressed }: { pressed: boolean }) => ({
								alignItems: 'center',
								backgroundColor: pressed ? '#35373c' : '#2b2d31',
								borderRadius: 12,
								flexDirection: 'row',
								minHeight: 58,
								opacity: busy || !name.trim() ? 0.5 : 1,
								paddingHorizontal: 12,
							})}
						>
							{guild.icon ? (
								<ReactNative.Image
									source={{
										uri: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`,
									}}
									style={{
										borderRadius: 18,
										height: 36,
										marginRight: 12,
										width: 36,
									}}
								/>
							) : (
								<ReactNative.View
									style={{
										alignItems: 'center',
										backgroundColor: '#5865f2',
										borderRadius: 18,
										height: 36,
										justifyContent: 'center',
										marginRight: 12,
										width: 36,
									}}
								>
									<ReactNative.Text
										style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}
									>
										{guild.name.slice(0, 1).toUpperCase()}
									</ReactNative.Text>
								</ReactNative.View>
							)}
							<ReactNative.Text
								numberOfLines={1}
								style={{
									color: '#f2f3f5',
									flex: 1,
									fontSize: 15,
									fontWeight: '600',
								}}
							>
								{guild.name}
							</ReactNative.Text>
							<ReactNative.Text style={{ color: '#949ba4', fontSize: 18 }}>
								{busy ? '…' : '›'}
							</ReactNative.Text>
						</ReactNative.Pressable>
					))}
					{guilds.length === 0 ? (
						<ReactNative.Text
							style={{ color: '#b5bac1', paddingVertical: 16, textAlign: 'center' }}
						>
							You do not own any servers.
						</ReactNative.Text>
					) : null}
					{guilds.length > 0 && visibleGuilds.length === 0 ? (
						<ReactNative.Text
							style={{ color: '#b5bac1', paddingVertical: 16, textAlign: 'center' }}
						>
							No servers match that search.
						</ReactNative.Text>
					) : null}
				</ReactNative.View>
			</ReactNative.View>
		</Discord.ActionSheet>
	);
}

function openCloneSheet(expression: Expression): void {
	const sheets = getSheets();
	if (!sheets?.openLazy) throw new Error('Action sheets are unavailable on this client build.');
	const key = `${SHEET_KEY_PREFIX}clone-${Date.now()}`;
	sheets.openLazy(
		Promise.resolve({
			default: () => (
				<CloneSheet expression={expression} onClose={() => sheets.hideActionSheet?.(key)} />
			),
		}),
		key,
		{
			onClose: () => sheets.hideActionSheet?.(key),
		},
	);
}

function ExpressionActionBar({
	expression,
	sheetKey,
}: {
	expression: Expression;
	sheetKey: string;
}) {
	const React = metro.common.React;
	const ReactNative = metro.common.ReactNative;
	const [favorite, setFavorite] = React.useState(() => isFavoriteSticker(expression));
	const [updatingFavorite, setUpdatingFavorite] = React.useState(false);
	const close = () => {
		if (expression.kind === 'sticker') {
			const stickerSheets = metro.findByProps('hideStickerDetailActionSheet') as {
				hideStickerDetailActionSheet?: () => void;
			} | null;
			if (typeof stickerSheets?.hideStickerDetailActionSheet === 'function') {
				stickerSheets.hideStickerDetailActionSheet();
				return;
			}
		}
		getSheets()?.hideActionSheet?.(sheetKey);
	};
	const compactButton = (label: string, onPress: () => void, disabled = false) => (
		<ReactNative.Pressable
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }: { pressed: boolean }) => ({
				alignItems: 'center',
				backgroundColor: pressed ? '#4752c4' : '#5865f2',
				borderRadius: 9,
				flex: 1,
				justifyContent: 'center',
				minHeight: 38,
				opacity: disabled ? 0.55 : 1,
				paddingHorizontal: 6,
			})}
		>
			<ReactNative.Text
				numberOfLines={1}
				style={{ color: '#f2f3f5', fontSize: 12, fontWeight: '700' }}
			>
				{label}
			</ReactNative.Text>
		</ReactNative.Pressable>
	);

	return (
		<ReactNative.View
			style={{ flexDirection: 'row', gap: 6, marginHorizontal: 12, marginTop: 10 }}
		>
			{compactButton('Copy URL', () => {
				close();
				copyText(getExpressionLink(expression), 'URL copied to the clipboard.');
			})}
			{expression.kind === 'emoji'
				? compactButton('Copy markup', () => {
						close();
						copyText(getMarkup(expression), 'Emoji markup copied to the clipboard.');
					})
				: compactButton(
						favorite ? 'Unfavorite' : 'Favorite',
						() => {
							if (updatingFavorite) return;
							close();
							setUpdatingFavorite(true);
							void toggleFavoriteSticker(expression, !favorite)
								.then(() => setFavorite((value: boolean) => !value))
								.catch(showError)
								.finally(() => setUpdatingFavorite(false));
						},
						updatingFavorite,
					)}
			{compactButton('Clone', () => {
				close();
				openCloneSheet(expression);
			})}
		</ReactNative.View>
	);
}

function addToolsRows(result: unknown, expression: Expression, key: string): void {
	const rows = findChildArray(result);
	if (!rows || rows.some((row) => row?.type === ExpressionActionBar)) return;
	rows.push(
		metro.common.React.createElement(ExpressionActionBar, {
			expression,
			key: ACTION_ROW_KEY,
			sheetKey: key,
		}),
	);
}

function addToolsToRoot(result: unknown, expression: Expression, key: string): void {
	const rows = (result as { props?: { children?: unknown } } | null)?.props?.children;
	if (Array.isArray(rows)) {
		if (rows.some((row) => row?.type === ExpressionActionBar)) return;
		rows.push(
			metro.common.React.createElement(ExpressionActionBar, {
				expression,
				key: ACTION_ROW_KEY,
				sheetKey: key,
			}),
		);
		return;
	}
	addToolsRows(result, expression, key);
}

function patchDetailSheet(detail: object, expression: Expression, key: string): void {
	if (patchedDetailSheets.has(detail)) return;
	const element = detail as { type?: unknown };
	if (typeof element.type !== 'function') return;
	patchedDetailSheets.add(detail);

	unpatches.push(
		patcher.after(element as { type: (...args: any[]) => unknown }, 'type', (ctx) => {
			addToolsToRoot(ctx.result, expression, key);
			return ctx.result;
		}),
	);
}

function patchExpressionSheet(instance: object, kind: ExpressionKind, key: string): void {
	if (patchedSheets.has(instance)) return;
	const sheet = instance as { default?: unknown };
	if (typeof sheet.default !== 'function') return;
	patchedSheets.add(instance);

	unpatches.push(
		patcher.after(sheet as { default: (...args: any[]) => unknown }, 'default', (ctx) => {
			const expression = getExpression(kind, ctx.args[0]);
			if (!expression || !ctx.result || typeof ctx.result !== 'object') return ctx.result;

			addToolsRows(ctx.result, expression, key);
			const outer = ctx.result as { type?: unknown };
			if (typeof outer.type !== 'function' || patchedOuterSheets.has(outer))
				return ctx.result;
			patchedOuterSheets.add(outer);

			unpatches.push(
				patcher.after(
					outer as { type: (...args: any[]) => unknown },
					'type',
					(innerCtx) => {
						const detail = findElement(
							innerCtx.result,
							(element) =>
								Boolean(element.props?.emojiNode) &&
								element.props?.nonce !== undefined,
						);
						if (detail) patchDetailSheet(detail, expression, key);
						addToolsRows(innerCtx.result, expression, key);
						return innerCtx.result;
					},
				),
			);
			return ctx.result;
		}),
	);
}

function patchStickerSheet(): void {
	const module = metro.findByFilePath('modules/stickers/native/StickerDetailActionSheet.tsx') as {
		default?: { type?: unknown };
	} | null;
	const component = module?.default;
	if (!component || typeof component.type !== 'function') return;

	unpatches.push(
		patcher.after(component as { type: (...args: any[]) => unknown }, 'type', (ctx) => {
			const expression = parseSticker(ctx.args[0]) ?? parseSticker(ctx.result);
			const detail = findElement(
				ctx.result,
				(element) => getTypeName(element) === 'GuildStickerDetail',
			);
			if (expression && detail)
				patchDetailSheet(detail as object, expression, 'StickerDetailActionSheet');
			return ctx.result;
		}),
	);
}

function start(): void {
	const activeLifecycle = ++lifecycle;
	patchedSheets = new WeakSet<object>();
	patchedOuterSheets = new WeakSet<object>();
	patchedDetailSheets = new WeakSet<object>();
	const sheets = getSheets();
	if (!sheets?.openLazy) throw new Error('Action sheets are unavailable on this client build.');

	unpatches.push(
		patcher.before(sheets as { openLazy: (...args: any[]) => unknown }, 'openLazy', (ctx) => {
			const [componentPromise, key] = ctx.args as [
				Promise<{ default?: unknown }> | undefined,
				unknown,
			];
			if (typeof key !== 'string' || !componentPromise?.then) return;
			const kind = /emoji/i.test(key) ? 'emoji' : /sticker/i.test(key) ? 'sticker' : null;
			if (!kind) return;

			void componentPromise
				.then((instance) => {
					if (activeLifecycle !== lifecycle) return;
					if (instance && typeof instance === 'object')
						patchExpressionSheet(instance, kind, key);
				})
				.catch(() => undefined);
		}),
	);
	patchStickerSheet();
}

function stop(): void {
	lifecycle++;
	for (const unpatch of unpatches.splice(0)) unpatch();
	patchedSheets = new WeakSet<object>();
	patchedOuterSheets = new WeakSet<object>();
	patchedDetailSheets = new WeakSet<object>();
}

export default { start, stop };
