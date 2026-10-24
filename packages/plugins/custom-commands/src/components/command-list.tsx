import { Discord } from '@unbound-app/api/metro/components';
import { Alert } from 'react-native';

import { deleteTag } from '~/saved-commands';
import type { Tag } from '~/tags';

type CommandListProps = {
	tags: Tag[];
	onCreate: () => void;
	onEdit: (tag: Tag) => void;
};

function summarize(tag: Tag): string {
	const count = tag.media.length;

	return tag.description || tag.message || `${count} attachment${count === 1 ? '' : 's'}`;
}

function confirmDelete(tag: Tag) {
	Alert.alert('Delete command', `Delete /${tag.name} and its saved attachments?`, [
		{ text: 'Cancel', style: 'cancel' },
		{ text: 'Delete', style: 'destructive', onPress: () => deleteTag(tag) },
	]);
}

function CommandList({ tags, onCreate, onEdit }: CommandListProps) {
	return (
		<>
			<Discord.TableRowGroup title='Registered commands'>
				{tags.length ? (
					tags.map((tag) => (
						<Discord.TableRow
							key={tag.name}
							label={`/${tag.name}`}
							subLabel={summarize(tag)}
							subLabelLineClamp={2}
							trailing={
								<Discord.Stack direction='horizontal' spacing={8}>
									<Discord.Button
										size='sm'
										variant='secondary'
										text='Edit'
										accessibilityLabel={`Edit ${tag.name}`}
										onPress={() => onEdit(tag)}
									/>
									<Discord.Button
										size='sm'
										variant='destructive'
										text='Delete'
										accessibilityLabel={`Delete ${tag.name}`}
										onPress={() => confirmDelete(tag)}
									/>
								</Discord.Stack>
							}
						/>
					))
				) : (
					<Discord.TableRow label='No custom commands yet.' />
				)}
			</Discord.TableRowGroup>
			<Discord.Button text='Create command' onPress={onCreate} />
		</>
	);
}

export default CommandList;
