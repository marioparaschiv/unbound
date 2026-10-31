import { IconMapSearch } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';

import StatusPage from '~/components/status-page';
import { Button } from '~/components/ui/button';

function NotFound() {
	return (
		<StatusPage
			icon={IconMapSearch}
			title='Page Not Found'
			description='The page you were looking for does not exist or has moved.'
			code='404'
			actions={
				<>
					<Button size='lg' className='w-full' asChild>
						<Link to='/'>Go Home</Link>
					</Button>
					<Button variant='outline' size='lg' className='w-full' asChild>
						<Link to='/plugins'>Browse Plugins</Link>
					</Button>
				</>
			}
		/>
	);
}

export default NotFound;
