import {
	IconCopies,
	IconDots,
	IconExternalLink,
	IconPhoto,
	IconShield,
	IconUsers,
} from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { warmAddonIconAtlas } from '~/components/addon-icon-picker/atlas-icon';
import MaintainersDialog from '~/components/dashboard/maintainers-dialog';
import { maintainersQuery } from '~/queries/dashboard/maintainers';
import usePrefetchIntent from '~/queries/use-prefetch-intent';
import copyText from '~/components/dashboard/copy-text';
import type { DashboardAddon } from '~/lib/dashboard';
import { Button } from '~/components/ui/button';

type AddonMenuProps = {
	addon: DashboardAddon;
	userId: string;
	/** Opens the icon picker, which hangs from the row's icon tile. */
	onChangeIcon: () => void;
};

function AddonMenu({ addon, userId, onChangeIcon }: AddonMenuProps) {
	const [maintainersOpen, setMaintainersOpen] = useState(false);
	const prefetchMaintainers = usePrefetchIntent(maintainersQuery(addon.id));
	const { actions } = addon;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant='outline'
						size='icon-sm'
						aria-label={`More actions for ${addon.name}`}
					>
						<IconDots size={24} />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align='end'>
					<DropdownMenuItem onClick={() => copyText(addon.id, 'addon ID')}>
						<IconCopies size={24} />
						Copy addon ID
					</DropdownMenuItem>
					{actions.publicPage ? (
						<DropdownMenuItem asChild>
							<Link to='/addons/$id' params={{ id: addon.id }}>
								<IconExternalLink size={24} />
								View public page
							</Link>
						</DropdownMenuItem>
					) : null}
					{actions.icon ? (
						<DropdownMenuItem
							onClick={onChangeIcon}
							// Downloads and decodes the atlas, so the picker opens on a ready image.
							onPointerEnter={() => void warmAddonIconAtlas()}
						>
							<IconPhoto size={24} />
							Change icon
						</DropdownMenuItem>
					) : null}
					{actions.maintainers ? (
						<DropdownMenuItem
							onClick={() => setMaintainersOpen(true)}
							{...prefetchMaintainers}
						>
							<IconUsers size={24} />
							Maintainers
						</DropdownMenuItem>
					) : null}
					{actions.staffManage ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link to='/admin/addons/$id' params={{ id: addon.id }}>
									<IconShield size={24} />
									Manage in admin
								</Link>
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
			{actions.maintainers ? (
				<MaintainersDialog
					addonId={addon.id}
					userId={userId}
					open={maintainersOpen}
					onOpenChange={setMaintainersOpen}
				/>
			) : null}
		</>
	);
}

export default AddonMenu;
