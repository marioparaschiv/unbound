import { View, Image, TouchableOpacity } from 'react-native';
import type { Badge } from '@typings/built-ins/badges';
import type { BuiltInData } from '@typings/built-ins';
import { createLogger } from '@structures/logger';
import { SocialLinks, Times } from '@constants';
import { useEffect, useState } from 'react';
import { Theme } from '@api/metro/stores';
import { createPatcher } from '@patcher';
import { showToast } from '@api/toasts';
import { findByName } from '@api/metro';


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
		Patcher.after(Badge, 'default', (_, [{ user, isUnbound, style, ...rest }], res) => {
			const [badges, setBadges] = useState({ data: [] });
			if (isUnbound) return res;

			useEffect(() => {
				try {
					fetchUserBadges(user.id).then(badges => setBadges({ data: badges }));
				} catch (e) {
					Logger.error(`Failed to request/parse badges for ${user.id}`);
				}
			}, []);

			if (!badges.data.length) return res;

			if (!res) {
				// TODO: Figure out how to do handle users without any badges
				return;
			}

			const payload = badges.data.map((badge) => makeBadge(badge, style));

			if (res?.props.badges) {
				res.props.badges.push(...payload);
			} else if (res?.props.children) {
				res?.props.children.push(...payload);
			}
		});
	}
}

export function stop() {
	Patcher.unpatchAll();
}

async function fetchUserBadges(id: string): Promise<string[]> {
	// Refresh badge cache hourly
	if (cache.user[id]?.date && (Date.now() - cache.user[id].date) < Times.HOUR) {
		return cache.user[id].badges;
	}

	const res = await fetch(SocialLinks.Badges + id + '.json', {
		headers: {
			'Cache-Control': 'no-cache'
		}
	}).then(r => r.json()).catch(() => []);

	if (Array.isArray(res)) {
		cache.user[id] = {
			badges: res,
			date: Date.now()
		};
	}

	return res;
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
		<Badge
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


const Badge = ({ type, size, margin }: { type: string; size: number; margin: number; }): JSX.Element => {
	const [badge, setBadge] = useState(null);

	useEffect(() => {
		try {
			fetchBadge(type).then(setBadge);
		} catch (e) {
			Logger.error(`Failed to get badge data for ${type}.`, e.message);
		}
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

async function fetchBadge(type: string): Promise<Badge> {
	// Refresh badge cache hourly
	if (cache.badges[type]?.date && (Date.now() - cache.badges[type].date) < Times.HOUR) {
		return cache.badges[type].data;
	}

	const res = await fetch(SocialLinks.Badges + `data/${type}.json`, {
		headers: {
			'Cache-Control': 'no-cache'
		}
	}).then(r => r.json()).catch(() => { });

	if (res?.url) {
		cache.badges[type] = {
			data: res,
			date: Date.now()
		};
	}

	return res;
}