import type { PressableStateCallbackType } from 'react-native';
import type { AddonAuthor } from '@unbound-app/types';
import { Pressable } from 'react-native';
import { memo } from 'react';

import { AvatarPiles, Discord, Avatars } from '~/api/metro/components';
import { ActionSheets, UserProfiles } from '~/api/metro/api';
import { Theme } from '~/api/metro/common';

import AddonAuthorsSheet from './addon-authors-sheet';
import useAuthorUsers from './use-author-users';
import useStyles from './addon-authors.style';

type AddonAuthorsProps = {
	authors: AddonAuthor[];
};

const SHEET_KEY = 'unbound-addon-authors';

/**
 * @description An addon's author line: their avatars in a pile, then their manifest names. Pressing it
 * opens the profile of a sole resolved author, or a sheet listing every author.
 */
function AddonAuthors({ authors }: AddonAuthorsProps) {
	const styles = useStyles();
	const resolved = useAuthorUsers(authors);
	const names = authors.map((author) => author.name);
	const label = names.join(', ');
	const { AvatarPile } = AvatarPiles;
	const { Avatar, AvatarSizes } = Avatars;

	function press() {
		const [only] = resolved;

		if (resolved.length === 1 && only?.user) {
			UserProfiles.default({ userId: only.user.id });

			return;
		}

		ActionSheets.openLazy(Promise.resolve({ default: AddonAuthorsSheet }), SHEET_KEY, {
			authors: resolved,
			onClose: () => ActionSheets.hideActionSheet(SHEET_KEY),
		});
	}

	return (
		<Pressable
			accessibilityRole='button'
			accessibilityLabel={label}
			hitSlop={6}
			onPress={press}
			style={({ pressed }: PressableStateCallbackType) => [
				styles.container,
				pressed ? styles.pressed : null,
			]}
		>
			<AvatarPile size={AvatarSizes.XSMALL_20} names={names} totalCount={authors.length}>
				{resolved.map(({ author, avatar }, index) => (
					<Avatar
						key={`${author.id}-${index}`}
						source={avatar}
						size={AvatarSizes.XSMALL_20}
					/>
				))}
			</AvatarPile>
			<Discord.Text
				variant='text-xs/medium'
				style={[styles.names, { color: Theme.colors.TEXT_MUTED }]}
				numberOfLines={1}
			>
				{label}
			</Discord.Text>
		</Pressable>
	);
}

export default memo(AddonAuthors);
