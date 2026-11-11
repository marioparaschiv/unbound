import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { dialogs } from '@unbound-app/api';

import { deleteTag } from '~/lib/saved-commands';
import type { Tag } from '~/lib/tags';

type CommandListProps = {
	tags: Tag[];
	onCreate: () => void;
	onEdit: (tag: Tag) => void;
};

function summarize(tag: Tag): string {
	const count = tag.media.length;

	return tag.description || tag.message || format('ATTACHMENT_COUNT', { count });
}

async function confirmDelete(tag: Tag) {
	const confirmed = await dialogs.confirm('DELETE_COMMAND', {
		body: 'DELETE_COMMAND_BODY',
		bodyVars: { name: tag.name },
		confirm: 'DELETE',
		destructive: true,
	});

	if (confirmed) deleteTag(tag);
}

function CommandList({ tags, onCreate, onEdit }: CommandListProps) {
	return (
		<>
			<Discord.TableRowGroup title={messages.REGISTERED_COMMANDS}>
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
										text={messages.EDIT}
										accessibilityLabel={format('EDIT_COMMAND_LABEL', {
											name: tag.name,
										})}
										onPress={() => onEdit(tag)}
									/>
									<Discord.Button
										size='sm'
										variant='destructive'
										text={messages.DELETE}
										accessibilityLabel={format('DELETE_COMMAND_LABEL', {
											name: tag.name,
										})}
										onPress={() => void confirmDelete(tag)}
									/>
								</Discord.Stack>
							}
						/>
					))
				) : (
					<Discord.TableRow label={messages.NO_COMMANDS} />
				)}
			</Discord.TableRowGroup>
			<Discord.Button text={messages.CREATE_COMMAND} onPress={onCreate} />
		</>
	);
}

export default CommandList;
