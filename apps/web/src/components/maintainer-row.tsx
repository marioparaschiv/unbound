import type { UserSummary } from '@unbound-app/contracts/account';
import { IconXmark } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';

type MaintainerRowProps = {
	maintainer: UserSummary;
	/** Sits beside the name, such as the maintainer's role. */
	badge?: ReactNode;
	/** `null` when the viewer may not remove this maintainer. */
	onRemove: (() => void) | null;
	disabled: boolean;
};

/**
 * @description One maintainer in a list: avatar, name, user ID and a remove button.
 * @param props The maintainer, an optional badge and what removing them does.
 * @returns The list item.
 */
function MaintainerRow({ maintainer, badge, onRemove, disabled }: MaintainerRowProps) {
	return (
		<li className='flex items-center gap-3 hover:bg-accent/40 px-2 py-1.5 rounded-control transition-colors'>
			<UserAvatar src={maintainer.image} name={maintainer.name} size='sm' />
			<span className='flex flex-col flex-1 min-w-0'>
				<span className='flex items-center gap-2 min-w-0'>
					<Text as='span' variant='text-sm' className='font-medium truncate'>
						{maintainer.name}
					</Text>
					{badge}
				</span>
				<Text as='span' variant='text-xs' color='muted' className='font-mono truncate'>
					{maintainer.id}
				</Text>
			</span>
			{onRemove ? (
				<Button
					type='button'
					variant='ghost'
					size='icon-sm'
					aria-label={`Remove ${maintainer.name}`}
					disabled={disabled}
					onClick={onRemove}
				>
					<IconXmark size={14} />
				</Button>
			) : null}
		</li>
	);
}

export default MaintainerRow;
