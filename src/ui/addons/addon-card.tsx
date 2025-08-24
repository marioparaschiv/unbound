import AddonAuthorsSheet, { type AddonAuthorsSheetAuthor } from '@ui/sheets/addon-authors-sheet';
import { ManagerEntityNames, ManagerNames, Screens } from '@constants';
import type { AddonCardProps } from '@typings/ui/addons/addon-card';
import { Avatar, Discord } from '@api/metro/components';
import { TouchableOpacity, View } from 'react-native';
import { useSettingsStore } from '@api/storage';
import { Clipboard } from '@api/metro/common';
import useUsers from '@ui/hooks/use-users';
import { showDialog } from '@api/dialogs';
import { Switch } from '@ui/misc/forms';
import { showToast } from '@api/toasts';
import { showSheet } from '@api/sheet';
import * as Managers from '@managers';
import { Icons } from '@api/assets';
import { useMemo } from 'react';

import useStyles from './addon-card.style';


function AddonCard(props: AddonCardProps) {
	const { addon, kind } = props;

	const manager = useMemo<Values<typeof Managers>>(() => Managers[ManagerNames[kind]], [kind]);
	const settings = useSettingsStore('unbound', ({ key }) => key === 'recovery');
	const authors = useUsers(addon.data.authors.map((author) => author.id));
	const navigation = Discord.useNavigation();
	const styles = useStyles();

	if (!manager) return null;

	const addonAuthors = useMemo(() => {
		return addon.data.authors.reduce<AddonAuthorsSheetAuthor[]>((prev, curr: AddonAuthorsSheetAuthor) => {
			const user = authors.find((author) => author.id === curr.id);

			if (user) {
				curr.user = user;
			} else {
				curr.user = null;
			}

			return [...prev, curr];
		}, []);
	}, [addon, authors]);

	return <View style={styles.container}>
		<Discord.Card style={styles.card}>
			<View style={styles.header}>
				<Discord.Text color='text-normal' variant='text-lg/bold'>
					{addon.data.name}
				</Discord.Text>
				<View style={styles.actions}>
					<Discord.ContextMenu
						title={`${ManagerEntityNames[kind]} Options`}
						align='left'
						items={[
							{
								label: 'Reload',
								iconSource: Icons['RefreshIcon'],
								action: () => {
									// manager.(addon.id);
								}
							},
							{
								label: 'Re-fetch',
								iconSource: Icons['DownloadIcon'],
								action: () => {
									// manager.(addon.id);
								}
							},
							{
								label: 'Copy URL',
								iconSource: Icons['CopyIcon'],
								action: () => {
									Clipboard.setString(addon.data.url);
									showToast({
										title: 'URL Copied',
										duration: 2500,
										content: `The URL for ${addon.data.name} has been copied to your clipboard.`,
										icon: Icons['CopyIcon']
									});
								}
							},
							// {
							// 	label: 'View in Marketplace',
							// 	iconSource: Icons['ShopSparkleIcon'],
							// 	action: () => {
							// 		navigation.push(Screens.Marketplace, {
							// 			addonId: addon.id
							// 		});
							// 	}
							// },
							{
								label: 'Uninstall',
								variant: 'destructive',
								iconSource: Icons['TrashIcon'],
								action: () => {
									showDialog({
										title: `Uninstall ${ManagerEntityNames[kind]}`,
										content: `Are you sure you want to uninstall ${addon.data.name}?`,
										buttons: [
											{
												text: 'Uninstall',
												variant: 'destructive',
												onPress: () => manager.delete(addon.id)
											}
										]
									});
								}
							},
						]}
					>
						{(props) => <Discord.IconButton
							{...props}
							icon={Icons['MoreHorizontalIcon']}
							variant='secondary'
							size='sm'
						/>}
					</Discord.ContextMenu>
					{typeof addon.instance.getSettingsPanel === 'function' && <Discord.IconButton
						icon={Icons['SettingsIcon']}
						variant='secondary'
						size='sm'
						onPress={() => {
							navigation.push(Screens.Custom, {
								title: `${addon.data.name} - Settings`,
								render: addon.instance.getSettingsPanel
							});
						}}
					/>}
					<Switch.FormSwitch
						disabled={addon.failed || settings.get('recovery', false)}
						value={manager.isEnabled(addon.id)}
						onValueChange={() => manager.toggle(addon.id)}
					/>
				</View>
			</View>
			<TouchableOpacity
				style={styles.authors}
				onPress={() => showSheet({
					component: AddonAuthorsSheet,
					props: {
						authors: addonAuthors
					}
				})}
			>
				<Discord.AvatarPile
					size='xsmall'
					names={addonAuthors.slice(0, 3).map((author) => author.user?.globalName ?? author.user?.username ?? author.name ?? 'Unknown')}
					totalCount={addonAuthors.length}
				>
					{addonAuthors.filter(author => author.user).map(({ user }) => <Avatar.default
						key={user.id}
						size={Avatar.AvatarSizes.XSMALL}
						user={user}
					/>)}
				</Discord.AvatarPile>
				<Discord.Text color='text-muted' variant='text-sm/semibold'>
					{Discord.AvatarPile({
						size: 'xsmall',
						names: addonAuthors.slice(0, 3).map((author) => author.user?.globalName ?? author.user?.username ?? author.name ?? 'Unknown'),
						totalCount: addonAuthors.length
					}).props['aria-label']}
				</Discord.Text>
			</TouchableOpacity>
			<Discord.Text color='text-muted-on-default' variant='text-md/normal' numberOfLines={2} ellipsizeMode='tail'>
				{addon.data.description}
			</Discord.Text>
		</Discord.Card>
	</View>;
}

export default AddonCard;