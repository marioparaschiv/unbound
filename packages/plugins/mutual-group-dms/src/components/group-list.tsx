import { Discord } from '@unbound-app/api/metro/components';
import { Pressable } from 'react-native';

import type { MutualGroup } from '~/lib/groups';

type GroupListProps = {
	groups: MutualGroup[];
	onOpen: (channelId: string) => void;
};

function GroupList({ groups, onOpen }: GroupListProps) {
	return (
		<Discord.Stack spacing={4}>
			{groups.map((group) => (
				<Pressable
					key={group.id}
					accessibilityRole='button'
					onPress={() => onOpen(group.id)}
					style={({ pressed }) => ({ paddingVertical: 10, opacity: pressed ? 0.5 : 1 })}
				>
					<Discord.Text variant='text-md/medium' lineClamp={1}>
						{group.name}
					</Discord.Text>
				</Pressable>
			))}
		</Discord.Stack>
	);
}

export default GroupList;
