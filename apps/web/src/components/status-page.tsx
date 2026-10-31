import type { ComponentType, ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

import Logo from '~/components/icons/logo';
import Text from '~/components/ui/text';

type IconProps = {
	size?: number;
};

type StatusPageProps = {
	icon: ComponentType<IconProps>;
	title: string;
	description: string;
	/** A short machine code shown under the description, e.g. "404". */
	code?: string;
	actions?: ReactNode;
};

function StatusPage({ icon: Icon, title, description, code, actions }: StatusPageProps) {
	return (
		<div className='flex flex-col items-center justify-center flex-1 dotted-bg px-4'>
			<div className='flex flex-col items-center gap-8 w-full max-w-sm'>
				<Link to='/' className='transition-transform hover:scale-110 duration-300'>
					<Logo className='size-20' />
				</Link>
				<div className='flex flex-col items-center gap-3 text-center'>
					<div className='flex justify-center items-center bg-muted rounded-control size-10 text-muted-foreground'>
						<Icon size={20} />
					</div>
					<div className='flex flex-col items-center gap-1'>
						<h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
						<p className='text-sm text-muted-foreground text-balance'>{description}</p>
					</div>
					{code ? (
						<Text variant='text-xs' color='muted' className='font-mono'>
							{code}
						</Text>
					) : null}
				</div>
				{actions ? <div className='flex flex-col gap-2 w-full'>{actions}</div> : null}
			</div>
		</div>
	);
}

export default StatusPage;
