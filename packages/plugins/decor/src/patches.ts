import { flux, metro, patcher } from '@unbound-app/api';

import { DECOR_SKU, decorDecoration, decorImage, type AvatarDecoration } from '~/lib/decor';
import { decoratedUsers, decorationOf, whenDecorationsFetched } from '~/lib/decorations';

type UserRecord = { id: string; avatarDecorationData?: AvatarDecoration | null };

type DecorationOptions = { avatarDecoration?: AvatarDecoration | null; canAnimate?: boolean };

type DecorationUtils = {
	getAvatarDecorationURL: (options: DecorationOptions) => string | undefined;
};

const hasDecorationUrl = (target: unknown): target is DecorationUtils =>
	typeof (target as Partial<DecorationUtils> | undefined)?.getAvatarDecorationURL === 'function';

const originals = new Map<string, AvatarDecoration | null>();

function decorate(user: UserRecord | undefined): void {
	if (!user?.id) return;

	const asset = decorationOf(user.id);

	if (!asset || user.avatarDecorationData?.skuId === DECOR_SKU) return;

	if (!originals.has(user.id)) originals.set(user.id, user.avatarDecorationData ?? null);

	user.avatarDecorationData = decorDecoration(asset);
}

function patchDecorationUrl(target: unknown): void {
	if (!hasDecorationUrl(target)) return;

	patcher.instead(target, 'getAvatarDecorationURL', ({ args, original, this: self }) => {
		const { avatarDecoration, canAnimate } = (args[0] ?? {}) as DecorationOptions;

		if (avatarDecoration?.skuId === DECOR_SKU)
			return decorImage(avatarDecoration.asset, canAnimate);

		return original.apply(self, args);
	});
}

/**
 * @description Shows Decor avatar decorations in chat and on profiles. Gives each user record its Decor decoration as
 * `UserStore` hands it out, and teaches Discord's avatar utilities to draw it.
 */
export function patchDecorations(): void {
	const UserStore = flux.getStore('User');
	const AvatarUtils = metro.findByProps('getAvatarDecorationURL', { lazy: false });

	if (!AvatarUtils) {
		logger.warn('Decor skipped: Discord moved getAvatarDecorationURL.');

		return;
	}

	patchDecorationUrl(AvatarUtils);
	patchDecorationUrl(AvatarUtils.default);
	patcher.after(UserStore, 'getUser', ({ result }) => decorate(result as UserRecord | undefined));
	patcher.after(UserStore, 'getCurrentUser', ({ result }) =>
		decorate(result as UserRecord | undefined),
	);
	whenDecorationsFetched(() => UserStore.emitChange());
}

/**
 * @description Gives decorated users back the decoration Discord had for them.
 */
export function restoreDecorations(): void {
	const UserStore = flux.getStore('User');

	for (const id of decoratedUsers()) {
		const user = UserStore.getUser(id) as UserRecord | undefined;

		if (user?.avatarDecorationData?.skuId === DECOR_SKU)
			user.avatarDecorationData = originals.get(id) ?? null;
	}

	originals.clear();
	UserStore.emitChange();
}
