import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { assets } from '@unbound-app/api';

import type { Tag } from '~/lib/tags';

type CommandListProps = {
	tags: Tag[];
	/** Opens a command's sub-page; with no name, the page for a new one. */
	onOpen: (name?: string) => void;
};

function summarize(tag: Tag): string {
	const count = tag.media.length;

	return tag.description || tag.message || format('ATTACHMENT_COUNT', { count });
}

function CommandList({ tags, onOpen }: CommandListProps) {
	return (
		<Discord.TableRowGroup title={messages.REGISTERED_COMMANDS}>
			{tags.map((tag) => (
				<Discord.TableRow
					key={tag.name}
					label={format('COMMAND_TITLE', { name: tag.name })}
					subLabel={summarize(tag)}
					subLabelLineClamp={2}
					accessibilityLabel={format('EDIT_COMMAND_LABEL', { name: tag.name })}
					arrow
					onPress={() => onOpen(tag.name)}
				/>
			))}
			<Discord.TableRow
				label={messages.CREATE_COMMAND}
				icon={<Discord.TableRow.Icon source={assets.getIdByName('PlusSmallIcon')} />}
				onPress={() => onOpen()}
			/>
		</Discord.TableRowGroup>
	);
}

export default CommandList;
