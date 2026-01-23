import type { UnboundBadge } from '@unbound-app/types/built-ins';
import type { BuiltInData } from '@unbound-app/types/built-ins';
import { View, Image, TouchableOpacity } from 'react-native';
import { useEffect, useState, type JSX } from 'react';
import { SocialLinks, Times } from '~/lib/constants';
import { createLogger } from '~/structures/logger';
import { createPatcher } from '~/api/patcher';
import { Theme } from '~/api/metro/stores';
import { showToast } from '~/api/toasts';
import { findByName } from '~/api/metro';


const Patcher = createPatcher('unbound::badges');
const Logger = createLogger('Core', 'Badges');

export const data: BuiltInData = {
	name: 'Badges'
};

const cache = {
	user: {},
	badges: {}
};

export function start() {
	const Badges = findByName('ProfileBadges', { all: true, interop: false });

	for (const Badge of Badges) {
		Patcher.after(Badge, 'default', ({ args, result }) => {
			const { user, isUnbound, style, ...rest } = args[0];
			const [badges, setBadges] = useState<{ data: string[]; }>({ data: [] });
			if (isUnbound) return result;

			useEffect(() => {
				async function onMount(userId: string, signal: AbortController) {
					try {
						const badges = await fetchUserBadges(userId, signal.signal);
						if (badges) setBadges({ data: badges });
					} catch (e) {
						Logger.error(`Failed to request/parse badges for ${user.id}`);
					}
				}

				const signal = new AbortController();
				onMount(user.id, signal);

				return () => signal.abort();
			}, []);

			if (!badges.data.length) return result;

			if (!result) {
				// TODO: Figure out how to do handle users without any badges
				return;
			}

			const payload = badges.data.map((badge) => makeBadge(badge, style));

			if (result?.props.badges) {
				result.props.badges.push(...payload);
			} else if (result?.props.children) {
				result?.props.children.push(...payload);
			}
		});
	}
}

export function stop() {
	Patcher.unpatchAll();
}

async function fetchUserBadges(id: string, signal: AbortSignal): Promise<string[] | void> {
	// Refresh badge cache hourly
	if (cache.user[id]?.date && (Date.now() - cache.user[id].date) < Times.HOUR) {
		return cache.user[id].badges;
	}

	const response = await fetch(SocialLinks.Badges + id + '.json', {
		// React Native's AbortController typing is broken for fetch
		signal: signal as any,
		headers: {
			'Cache-Control': 'no-cache'
		}
	});

	if (signal.aborted) return;

	const data = await response.json().catch(() => null) as string[] | null;

	if (Array.isArray(data)) {
		cache.user[id] = {
			badges: data,
			date: Date.now()
		};

		return data;
	}

	return;
}

const makeBadge = (badge, style): JSX.Element => {
	return <View
		/* @ts-expect-error */
		unbound={true}
		key={badge}
		style={{
			alignItems: 'center',
			flexDirection: 'row',
			justifyContent: 'flex-end'
		}
		}
	>
		<UnboundBadge
			type={badge}
			size={
				Array.isArray(style)
					? style.find(r => r.paddingVertical && r.paddingHorizontal)
						? 18
						: 24
					: 20
			}
			margin={Array.isArray(style) ? 4 : 8}
		/>
	</View>;
};


const UnboundBadge = ({ type, size, margin }: { type: string; size: number; margin: number; }): JSX.Element | null => {
	const [badge, setBadge] = useState<UnboundBadge | null>(null);

	useEffect(() => {
		async function onMount(type: string, signal: AbortController) {
			try {
				const badge = await fetchBadge(type, signal.signal);
				if (badge) setBadge(badge);
			} catch (e) {
				Logger.error(`Failed to get badge data for ${type}.`, (e as Error).message);
			}
		}

		const signal = new AbortController();
		onMount(type, signal);

		return () => signal.abort();
	}, []);

	if (!badge?.url) {
		return null;
	}

	const styles = {
		image: {
			width: size,
			height: size,
			resizeMode: 'contain',
			marginLeft: margin,
			marginRight: margin + 1
		}
	};

	const uri = badge.url[Theme.theme] ?? badge.url.dark;
	if (!uri) return null;

	return <TouchableOpacity onPress={() => showToast({ title: badge.name, icon: { uri }, tintedIcon: false })}>
		<Image
			// @ts-expect-error
			style={styles.image}
			source={{ uri }
			}
		/>
	</TouchableOpacity >;
};

interface FetchBadgeCacheEntry {
	url: Record<string, string>;
}

async function fetchBadge(type: string, signal: AbortSignal): Promise<UnboundBadge | void> {
	// Refresh badge cache hourly
	if (cache.badges[type]?.date && (Date.now() - cache.badges[type].date) < Times.HOUR) {
		return cache.badges[type].data;
	}

	const response = await fetch(SocialLinks.Badges + `data/${type}.json`, {
		// React Native's AbortController typing is broken for fetch
		signal: signal as any,
		headers: {
			'Cache-Control': 'no-cache'
		}
	});

	if (signal.aborted) return;

	const data = await response.json().catch(() => null) as FetchBadgeCacheEntry | null;

	if (data && data.url) {
		cache.badges[type] = {
			data: data,
			date: Date.now()
		};
	}

	return;
}