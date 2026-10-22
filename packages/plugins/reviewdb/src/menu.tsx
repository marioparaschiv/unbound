import { metro, patcher } from '@unbound-app/api';

import { openReviewsSheet } from '@reviewdb/sheets/ReviewsSheet';

const Patcher = patcher.createPatcher('unbound.reviewdb');

function resolveUsername(userId: string): string {
	if (typeof metro?.findByProps !== 'function') return 'User';

	try {
		const UserStore = metro.findByProps('getCurrentUser', 'getUser') as {
			getUser?: (id: string) => { username?: string; globalName?: string } | null;
		} | null;
		const user = UserStore?.getUser?.(userId);
		return user?.globalName ?? user?.username ?? 'User';
	} catch {
		return 'User';
	}
}

function extractUserId(children: unknown): string | null {
	if (!Array.isArray(children)) return null;

	for (const child of children) {
		const userId = (child as { props?: { userId?: unknown } } | null)?.props?.userId;
		if (typeof userId === 'string') return userId;
	}

	return null;
}

function ReviewsButton({ userId }: { userId: string }) {
	const ReactNative = metro.common.ReactNative;
	const Discord = (metro as { components?: { Discord?: unknown } } | undefined)?.components
		?.Discord as { Button?: any } | undefined;
	if (!Discord?.Button) return null;

	return (
		<ReactNative.View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
			<Discord.Button
				text='View Reviews'
				variant='secondary'
				size='sm'
				onPress={() => openReviewsSheet(userId, resolveUsername(userId))}
			/>
		</ReactNative.View>
	);
}

export function startReviewMenuPatch(): void {
	if (typeof metro?.findByFilePath !== 'function' && typeof metro?.findByName !== 'function')
		return;

	const mod = (metro.findByFilePath?.('modules/user_profile/native/UserProfileCard.tsx', {
		interop: false,
	}) ?? metro.findByName?.('UserProfileCard', { interop: false })) as {
		default?: unknown;
	} | null;
	if (typeof mod?.default !== 'function') return;

	Patcher.after(mod as { default: unknown }, 'default', (ctx) => {
		const props = ctx.args?.[0] as { title?: unknown; children?: unknown } | undefined;
		if (!props || props.title) return ctx.result;

		const userId = extractUserId(props.children);
		if (!userId) return ctx.result;

		return metro.common.React.createElement(
			metro.common.React.Fragment,
			null,
			ctx.result as any,
			metro.common.React.createElement(ReviewsButton, { userId }),
		);
	});
}

export function stopReviewMenuPatch(): void {
	Patcher.unpatchAll();
}
