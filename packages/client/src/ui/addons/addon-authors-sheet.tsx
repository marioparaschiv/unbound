import { Avatars, BottomSheets } from '~/metro/components';
import { UserProfiles } from '~/metro/api';
import { format } from '~/i18n/api';

import type { AuthorUser } from './use-author-users';

type AddonAuthorsSheetProps = {
	authors: AuthorUser[];
	onClose: () => void;
};

/**
 * @description An action sheet listing an addon's authors, laid out like Discord's `SimpleActionSheet`.
 * Pressing an author with a Discord account closes the sheet and opens their profile.
 */
function AddonAuthorsSheet({ authors, onClose }: AddonAuthorsSheetProps) {
	const { Avatar, AvatarSizes } = Avatars;
	const { ActionSheet, ActionSheetRow, BottomSheetTitleHeader } = BottomSheets;

	return (
		<ActionSheet>
			<BottomSheetTitleHeader title={format('UNBOUND_AUTHORS')} />
			<ActionSheetRow.Group hasIcons>
				{authors.map(({ author, user, avatar }, index) => (
					<ActionSheetRow
						key={`${author.id}-${index}`}
						label={
							user
								? (user.globalName ?? user.username)
								: format('UNBOUND_UNKNOWN_USER')
						}
						subLabel={user ? `@${user.username}` : author.name}
						icon={<Avatar source={avatar} size={AvatarSizes.SMALL} />}
						onPress={
							user
								? () => {
										onClose();
										UserProfiles.default({ userId: user.id });
									}
								: void 0
						}
					/>
				))}
			</ActionSheetRow.Group>
		</ActionSheet>
	);
}

export default AddonAuthorsSheet;
