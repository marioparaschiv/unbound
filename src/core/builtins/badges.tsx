import { Badge } from '@typings/core/builtins/badges';
import { BuiltIn } from '@typings/core/builtins';
import { Links, Times } from '@constants';
import { createPatcher } from '@patcher';
import { Theme } from '@metro/stores';
import { findByName } from '@metro';

const Patcher = createPatcher('badges');

export const data: BuiltIn['data'] = {
	id: 'modules.badges',
	default: true
};

const cache = {
	user: {},
	badges: {}
};

export function initialize() {
	const Badges = findByName('ProfileBadges', { all: true, interop: false });

	for (const Badge of Badges) {
		Patcher.after(Badge, 'default', (_, [{ user, isEnmity, style, ...rest }], res) => {
			const [badges, setBadges] = React.useState({ data: [] });
			if (isEnmity) return res;

			React.useEffect(() => {
				try {
					fetchUserBadges(user.id).then(badges => setBadges({ data: badges }));
				} catch (e) {
					console.error(`Failed to request/parse badges for ${user.id}`);
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

export function shutdown() {
	Patcher.unpatchAll();
}

async function fetchUserBadges(id: string): Promise<string[]> {
	// Refresh badge cache hourly
	if (cache.user[id]?.date && (Date.now() - cache.user[id].date) < Times.HOUR) {
		return cache.user[id].badges;
	}

	const res = await fetch(Links.Badges + id + '.json', {
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
	return <ReactNative.View
		/* @ts-expect-error */
		enmity={true}
		key={badge}
		style={{
			alignItems: 'center',
			flexDirection: 'row',
			justifyContent: 'flex-end'
		}}
	>
		<Badge
			type={badge}
			size={Array.isArray(style)
				? style.find(r => r.paddingVertical && r.paddingHorizontal)
					? 18
					: 24
				: 20}
			margin={Array.isArray(style)
				? 4
				: 8}
		/>
	</ReactNative.View>;
};


const Badge = ({ type, size, margin }: { type: string; size: number; margin: number; }): JSX.Element => {
	const [badge, setBadge] = React.useState(null);

	React.useEffect(() => {
		try {
			fetchBadge(type).then(setBadge);
		} catch (e) {
			console.error(`Failed to get badge data for ${type}.`, e.message);
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

	const uri = badge.url[Theme.theme];

	return <ReactNative.TouchableOpacity
		onPress={() => { }}
	>
		<ReactNative.Image
			// @ts-expect-error
			style={styles.image}
			source={{ uri }}
		/>
	</ReactNative.TouchableOpacity>;
};

async function fetchBadge(type: string): Promise<Badge> {
	// Refresh badge cache hourly
	if (cache.badges[type]?.date && (Date.now() - cache.badges[type].date) < Times.HOUR) {
		return cache.badges[type].data;
	}

	const res = await fetch(Links.Badges + `data/${type}.json`, {
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