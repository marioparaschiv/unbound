import { IconGem, IconGift, IconHashtag, IconPlus } from 'nucleo-micro-bold';
import { BADGE_LIMIT } from '@unbound-app/contracts/sponsors';

import type { ShownBadge } from '~/components/user-badge';
import AvatarGlow from '~/components/avatar-glow';
import UserAvatar from '~/components/user-avatar';
import BadgeRow from '~/components/badge-row';
import Text from '~/components/ui/text';

type DiscordProfilePreviewProps = {
	name: string;
	image: string | null;
	/** The sponsor's badges; empty shows the slots they would fill. */
	badges: ShownBadge[];
};

// Stand-ins for the badges Discord itself shows, kept muted so the sponsor's own ones stand out.
const DISCORD_BADGES = [IconHashtag, IconGem, IconGift];

const EMPTY_SLOTS = Array.from({ length: BADGE_LIMIT }, (_, index) => index);

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
				<BadgeRow badges={badges}>
					{DISCORD_BADGES.map((Icon, index) => (
						<span
							key={index}
							className='grid size-6 place-items-center text-muted-foreground'
						>
							<Icon size={16} aria-hidden />
						</span>
					))}
					{badges.length === 0
						? EMPTY_SLOTS.map((slot) => (
								<span
									key={slot}
									className='grid size-6 place-items-center rounded-full border border-dashed border-primary/60 text-primary'
								>
									<IconPlus size={10} aria-hidden />
								</span>
							))
						: null}
				</BadgeRow>
			</div>
		</div>
	);
}

export default DiscordProfilePreview;
