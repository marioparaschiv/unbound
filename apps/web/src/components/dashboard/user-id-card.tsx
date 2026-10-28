import { IconCopies } from 'nucleo-micro-bold';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import copyText from '~/components/dashboard/copy-text';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';

type UserIdCardProps = {
	userId: string;
};

function UserIdCard({ userId }: UserIdCardProps) {
	return (
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle className='text-base'>Your User ID</CardTitle>
				<Text variant='text-sm' color='muted'>
					Share it with an addon’s owner so they can add you as a maintainer.
				</Text>
			</CardHeader>
			<CardContent className='flex gap-2'>
				<Input readOnly value={userId} aria-label='Your user ID' className='font-mono' />
				<Button variant='outline' onClick={() => copyText(userId, 'ID')}>
					<IconCopies size={24} />
					Copy
				</Button>
			</CardContent>
		</Card>
	);
}

export default UserIdCard;
