import { IconCopy, IconDots, IconExternalLink, IconShield, IconUsers } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import MaintainersDialog from '~/components/dashboard/maintainers-dialog';
import copyText from '~/components/dashboard/copy-text';
import type { DashboardAddon } from '~/lib/dashboard';
import { Button } from '~/components/ui/button';

type AddonMenuProps = {
	addon: DashboardAddon;
	userId: string;
};

function AddonMenu({ addon, userId }: AddonMenuProps) {
	const [maintainersOpen, setMaintainersOpen] = useState(false);
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
						<IconDots />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align='end'>
					<DropdownMenuItem onSelect={() => copyText(addon.id, 'addon ID')}>
						<IconCopy />
						Copy addon ID
					</DropdownMenuItem>
					{actions.publicPage ? (
						<DropdownMenuItem asChild>
							<Link to='/addons/$id' params={{ id: addon.id }}>
								<IconExternalLink />
								View public page
							</Link>
						</DropdownMenuItem>
					) : null}
					{actions.maintainers ? (
						<DropdownMenuItem onSelect={() => setMaintainersOpen(true)}>
							<IconUsers />
							Maintainers
						</DropdownMenuItem>
					) : null}
					{actions.staffManage ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link to='/admin/addons' search={{ search: addon.id }}>
									<IconShield />
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
