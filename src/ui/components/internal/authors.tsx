import { Constants, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { callbackWithAnimation } from '@utilities';
import { AsyncUsers, Profiles } from '@metro/api';
import { TintedIcon } from '@ui/components/misc';
import type { Addon } from '@typings/managers';
import { Redesign } from '@metro/components';
import { Users } from '@metro/stores';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';

const useStyles = StyleSheet.createStyles({
	authors: {
		color: Theme.colors.TEXT_NORMAL,
		fontFamily: Constants.Fonts.PRIMARY_BOLD,
		marginLeft: -4
	},

	description: {
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 16,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		marginBottom: 0
	}
});

function Avatar({ id, size = 24 }: { id: string, size?: number; }) {
	const [user, setUser] = React.useState(null);

	React.useEffect(() => {
		const maybeUser = Users.getUser(id);

		if (maybeUser && typeof maybeUser?.getAvatarURL === 'function') {
			setUser(maybeUser);
		} else {
			AsyncUsers.fetchProfile(id)
				.then(() => setUser(Users.getUser(id)))
				.catch(console.error);
		}
	}, []);

	return <RN.Image
		source={user ? { uri: user?.getAvatarURL() } : Icons['MoreHorizontalIcon']}
		style={{
			width: size,
			aspectRatio: 1,
			borderRadius: 9999
		}}
	/>;
}

function Unexpanded({ addon, styles, setExpanded }: { addon: Addon, styles: any, setExpanded: Fn; }) {
	return <RN.TouchableOpacity onPress={() => setExpanded(previous => !previous)}>
		<RN.View style={{ marginLeft: 8, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
			<RN.Text style={styles.description}>
				{Strings.UNBOUND_BY}
			</RN.Text>
			<RN.Text style={[styles.description, styles.authors]}>
				{Redesign.AvatarPile({
					size: 'xsmall',
					names: addon.data.authors.map(author => author.name).slice(0, 3),
					totalCount: addon.data.authors.length
				}).props['aria-label']}
			</RN.Text>
			<Redesign.AvatarPile
				size={'xsmall'} // 24 x 24
				names={addon.data.authors.map(author => author.name).slice(0, 2)}
				totalCount={addon.data.authors.length}
			>
				{addon.data.authors.map(author => (
					<Avatar key={author.id} id={author.id} />
				))}
			</Redesign.AvatarPile>
		</RN.View>
	</RN.TouchableOpacity>;
}

function Expanded({ addon, styles, setExpanded }: { addon: Addon, styles: any, setExpanded: Fn; }) {
	return <RN.View>
		<RN.TouchableOpacity onPress={() => setExpanded(previous => !previous)}>
			<RN.View style={{ marginLeft: 8, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<TintedIcon
					source={Icons['CloseLargeIcon']}
					size={16}
				/>
				<RN.Text style={styles.description}>
					{Strings.UNBOUND_COLLAPSE_AUTHORS}
				</RN.Text>
			</RN.View>
		</RN.TouchableOpacity>
		<Redesign.TableRowGroup>
			{addon.data.authors.map(author => (
				<RN.View key={author.id} style={{ marginLeft: -8 }}>
					<Redesign.TableRow
						label={author.name}
						icon={<Avatar id={author.id} size={32} />}
						onPress={async () => {
							if (!Users.getUser(author.id)) {
								await AsyncUsers.fetchProfile(author.id);
							}

							Profiles.showUserProfile({ userId: author.id });
						}}
						arrow
					/>
				</RN.View>
			))}
		</Redesign.TableRowGroup>
	</RN.View>;
}

export function Authors({ addon }: { addon: Addon; }) {
	const [expanded, setExpanded] = React.useState(false);
	const styles = useStyles();

	return React.createElement(expanded ? Expanded : Unexpanded, {
		addon,
		styles,
		setExpanded: callbackWithAnimation(setExpanded)
	});
}