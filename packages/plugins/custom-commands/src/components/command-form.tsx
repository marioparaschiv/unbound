import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { assets, dialogs, ui } from '@unbound-app/api';
import { useState } from 'react';

import { MAX_ATTACHMENTS, MAX_DESCRIPTION_LENGTH } from '~/lib/constants';
import { parseTagArguments, validateTag } from '~/lib/tags';
import { deleteTag, saveTag } from '~/lib/saved-commands';
import MediaRow from '~/components/media-row';
import { notify, notifyError } from '~/lib/notify';
import { isSaved, pickMedia } from '~/lib/media';
import type { DraftMedia } from '~/lib/media';
import type { Tag } from '~/lib/tags';
import { Commands } from '~/lib/modules';

type DiscordCommand = {
	displayName: string;
};

type CommandFormProps = {
	original: Tag | null;
	tags: Tag[];
	onClose: () => void;
};

function isBuiltInCommand(name: string): boolean {
	const commands: DiscordCommand[] = Commands.BUILT_IN_COMMANDS ?? [];

	return commands.some((command) => command.displayName === name);
}

function CommandForm({ original, tags, onClose }: CommandFormProps) {
	const [name, setName] = useState(original?.name ?? '');
	const [description, setDescription] = useState(original?.description ?? '');
	const [message, setMessage] = useState(original?.message ?? '');
	const [media, setMedia] = useState<DraftMedia[]>(original?.media ?? []);
	const [picking, setPicking] = useState(false);
	const [saving, setSaving] = useState(false);
	const detectedArguments = parseTagArguments(message);

	async function addMedia() {
		if (picking) return;

		setPicking(true);

		try {
			const picked = await pickMedia();

			if (media.length + picked.length > MAX_ATTACHMENTS) {
				throw new Error(format('TOO_MANY_ATTACHMENTS', { max: MAX_ATTACHMENTS }));
			}

			setMedia((current) => [...current, ...picked]);
		} catch (error) {
			notifyError(error, messages.SAVE_FAILED);
		} finally {
			setPicking(false);
		}
	}

	async function save() {
		if (saving) return;

		const fields = {
			name: name.trim().toLowerCase(),
			description: description.trim(),
			message,
		};
		const problem =
			validateTag(
				{ ...fields, media: media.filter(isSaved) },
				tags,
				original?.name,
				media.length,
			) ?? (isBuiltInCommand(fields.name) ? messages.NAME_TAKEN_BY_DISCORD : null);

		if (problem) {
			notify(problem);

			return;
		}

		setSaving(true);

		try {
			await saveTag(fields, media, original);
			onClose();
			notify(format('COMMAND_SAVED', { name: fields.name }));
		} catch (error) {
			notifyError(error, messages.SAVE_FAILED);
		} finally {
			setSaving(false);
		}
	}

	async function remove(tag: Tag) {
		const confirmed = await dialogs.confirm('DELETE_COMMAND', {
			body: 'DELETE_COMMAND_BODY',
			bodyVars: { name: tag.name },
			confirm: 'DELETE',
			destructive: true,
		});

		if (!confirmed) return;

		deleteTag(tag);
		onClose();
	}

	return (
		<Discord.Stack spacing={24}>
			<ui.Section>
				<ui.InputRow
					label={messages.COMMAND_NAME}
					placeholder={messages.COMMAND_NAME_PLACEHOLDER}
					value={name}
					onChange={setName}
				/>
				<ui.InputRow
					label={messages.DESCRIPTION_OPTIONAL}
					placeholder={messages.DESCRIPTION_PLACEHOLDER}
					maxLength={MAX_DESCRIPTION_LENGTH}
					value={description}
					onChange={setDescription}
				/>
			</ui.Section>
			<ui.Section
				title={messages.RESPONSE}
				description={
					detectedArguments.length
						? format('ARGUMENTS', {
								names: detectedArguments
									.map((argument) => argument.name)
									.join(', '),
							})
						: format('RESPONSE_HELP')
				}
			>
				<ui.MultilineRow
					label={messages.RESPONSE}
					placeholder={format('RESPONSE_PLACEHOLDER')}
					value={message}
					onChange={setMessage}
				/>
			</ui.Section>
			<ui.Section>
				{media.map((item, index) => (
					<MediaRow
						key={isSaved(item) ? item.storedName : `${item.uri}-${index}`}
						media={item}
						onRemove={() =>
							setMedia((current) =>
								current.filter((_, position) => position !== index),
							)
						}
					/>
				))}
				<ui.Row
					label={picking ? messages.OPENING_PHOTOS : messages.ATTACH_MEDIA}
					icon={assets.getIdByName('ImagePlusIcon')}
					disabled={picking}
					onPress={() => void addMedia()}
				/>
			</ui.Section>
			<Discord.Button
				text={
					saving
						? messages.SAVING
						: original
							? messages.SAVE_COMMAND
							: messages.CREATE_COMMAND
				}
				onPress={() => void save()}
			/>
			{original ? (
				<ui.Section>
					<ui.ButtonRow
						label={messages.DELETE_COMMAND}
						variant='danger'
						onPress={() => void remove(original)}
					/>
				</ui.Section>
			) : null}
		</Discord.Stack>
	);
}

export default CommandForm;
