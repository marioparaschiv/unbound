import { TouchableOpacity, View, Text, Image } from 'react-native';
import { createElement, useEffect, useState } from 'react';
import type { Addon, Author } from '@typings/managers';
import { AsyncUsers, Profiles } from '@api/metro/api';
import { Design } from '@api/metro/components';
import { TintedIcon } from '@ui/misc/forms';
import { Users } from '@api/metro/stores';
import { animate } from '@utilities';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';

import useStyles from './addon-authors.style';

function useUser(id) {
	const [user, setUser] = useState(null);

	useEffect(() => {
		const maybeUser = Users.getUser(id);

		if (maybeUser && typeof maybeUser?.getAvatarURL === 'function') {
			setUser(maybeUser);
		} else {
			AsyncUsers.fetchProfile(id).then(() => setUser(Users.getUser(id))).catch(console.error);
		}
	}, []);

	return user;
}

function Avatar({ id, size = 24 }: { id: string, size?: number; }) {
	const user = useUser(id);
	const styles = useStyles();

	return (
		<Image
			source={user ? { uri: user?.getAvatarURL() } : Icons['MoreHorizontalIcon']}
			style={{
				width: size,
				aspectRatio: 1,
				borderRadius: 9999,
				...(user ? {} : styles.iconTint)
			}}
		/>
	);
}

function AuthorRow({ author }: { author: Author; }) {
	const user = useUser(author.id);

	return <Design.TableRow
		label={author.name}
		subLabel={`@${user?.username}`}
		icon={<Avatar id={author.id} size={32} />}
		onPress={async () => {
			if (!Users.getUser(author.id)) {
				await AsyncUsers.fetchProfile(author.id);
			}

			Profiles.showUserProfile({ userId: author.id });
		}}
		arrow
	/>;
}

function Unexpanded({ addon, styles, setExpanded }: { addon: Addon, styles: any, setExpanded: Fn; }) {
	return <TouchableOpacity onPress={() => setExpanded(previous => !previous)}>
		<View style={{ marginLeft: 8, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
			<Text style={styles.description}>
				{Strings.UNBOUND_BY}
			</Text>
			<Text style={[styles.description, styles.authors]}>
				{Design.AvatarPile({
					size: 'xsmall',
					names: addon.data.authors.map(author => author.name).slice(0, 3),
					totalCount: addon.data.authors.length
				}).props['aria-label']}
			</Text>
			<Design.AvatarPile
				size={'xsmall'} // 24 x 24
				names={addon.data.authors.map(author => author.name).slice(0, 2)}
				totalCount={addon.data.authors.length}
			>
				{addon.data.authors.map(author => (
					<Avatar key={author.id} id={author.id} />
				))}
			</Design.AvatarPile>
		</View>
	</TouchableOpacity>;
}

function Expanded({ addon, styles, setExpanded }: { addon: Addon, styles: any, setExpanded: Fn; }) {
	return <View>
		<TouchableOpacity onPress={() => setExpanded(previous => !previous)}>
			<View style={{ marginLeft: 8, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<TintedIcon
					source={Icons['CloseLargeIcon']}
					size={16}
				/>
				<Text style={styles.description}>
					{Strings.UNBOUND_COLLAPSE_AUTHORS}
				</Text>
			</View>
		</TouchableOpacity>
		<Design.TableRowGroup>
			{addon.data.authors.map(author => (
				<AuthorRow
					author={author}
					key={author.id}
				/>
			))}
		</Design.TableRowGroup>
	</View>;
}

export function Authors({ addon }: { addon: Addon; }) {
	const [expanded, setExpanded] = useState(false);
	const styles = useStyles();

	return createElement(expanded ? Expanded : Unexpanded, {
		addon,
		styles,
		setExpanded: animate(setExpanded)
	});
}

export default { AuthorRow, Authors, Expanded, Unexpanded, Avatar };