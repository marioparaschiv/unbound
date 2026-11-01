import type { Badge } from '@unbound-app/contracts/sponsors';

import UserBadgeList from '~/components/user-badge-list';
import AvatarGlow from '~/components/avatar-glow';
import UserAvatar from '~/components/user-avatar';
import Text from '~/components/ui/text';

type DiscordProfilePreviewProps = {
	name: string;
	image: string | null;
	badges: Badge[];
};

/** A sketch of a Discord profile card, to show where sponsor badges appear. */
function DiscordProfilePreview({ name, image, badges }: DiscordProfilePreviewProps) {
	return (
		<div aria-hidden className='overflow-hidden rounded-surface border bg-card'>
			<div className='relative isolate h-16 overflow-hidden bg-primary/40'>
				{image ? <AvatarGlow src={image} className='opacity-70 saturate-200' /> : null}
			</div>
			<div className='flex flex-col gap-3 px-4 pb-4'>
				<UserAvatar
					size='xl'
					className='relative -mt-8 object-cover ring-4 ring-card'
					src={image}
					name={name}
				/>
				<Text variant='heading-sm' className='truncate leading-tight!'>
					{name}
				</Text>
				<UserBadgeList badges={badges} />
			</div>
		</div>
	);
}

export default DiscordProfilePreview;
