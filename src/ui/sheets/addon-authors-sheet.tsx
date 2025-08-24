import { Avatar, Discord } from '@api/metro/components';
import type { Author } from '@typings/managers';
import { Profiles } from '@api/metro/api';


export type AddonAuthorsSheetAuthor = (Author & { user: Record<PropertyKey, any>; });

interface AddonAuthorsSheetProps {
	authors: AddonAuthorsSheetAuthor[];
}

function AddonAuthorsSheet({ authors }: AddonAuthorsSheetProps) {
	return <Discord.ActionSheet>
		<Discord.TableRowGroup>
			{authors.map((author) => <Discord.TableRow
				label={author.user?.globalName ?? author.user?.username ?? author.name ?? 'Unknown'}
				icon={author.user && <Avatar.default user={author.user} />}
				subLabel={author.role}
				onPress={author.user ? (() => Profiles.showUserProfile({ userId: author.id })) : null}
			/>)}
		</Discord.TableRowGroup>
	</Discord.ActionSheet>;
}

export default AddonAuthorsSheet;