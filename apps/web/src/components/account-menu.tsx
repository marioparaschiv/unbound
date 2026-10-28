import {
	IconChevronDown,
	IconGridLayout,
	IconRectLogin,
	IconRectLogout,
	IconShield,
	IconUser,
} from 'nucleo-micro-bold';
import { Link, useRouteContext, useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import getAuthErrorMessage from '~/lib/auth/error-message';
import { getStaffAreas } from '~/lib/auth/staff-areas';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import authClient from '~/lib/auth/client';

function AccountMenu() {
	const router = useRouter();
	const session = useRouteContext({ from: '__root__', select: (context) => context.session });

	if (!session) {
		return (
			<Button asChild variant='default'>
				<Link to='/login'>
					<IconRectLogin size={24} />
					Login
				</Link>
			</Button>
		);
	}

	const { user } = session;

	async function signOut() {
		const { error } = await authClient.signOut();

		if (error) {
			toast.error(getAuthErrorMessage(error));

			return;
		}

		await router.invalidate();
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='ghost' className='group/account border-none'>
					<UserAvatar src={user.image} name={user.name} size='xs' />
					{/* Between md and lg the nav fills the bar, so the trigger shrinks to the avatar. */}
					<span className='md:max-lg:sr-only'>{user.name}</span>
					<IconChevronDown
						size={24}
						className='group-data-[state=open]/account:rotate-180! transition-transform'
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem asChild>
					<Link to='/account'>
						<IconUser size={24} />
						Account
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link to='/dashboard'>
						<IconGridLayout size={24} />
						Dashboard
					</Link>
				</DropdownMenuItem>
				{getStaffAreas(user.role).map((area) => (
					<DropdownMenuItem key={area.id} asChild>
						<Link to={area.to}>
							<IconShield size={24} />
							{area.label}
						</Link>
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => void signOut()} variant='destructive'>
					<IconRectLogout size={24} />
					Log Out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export default AccountMenu;
