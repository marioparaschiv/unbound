import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { useState } from 'react';

import { MAX_ATTACHMENTS, MAX_DESCRIPTION_LENGTH } from '~/constants';
import { parseTagArguments, validateTag } from '~/commands/tags';
import { saveTag } from '~/commands/saved-commands';
import MediaRow from '~/components/media-row';
import { notify, notifyError } from '~/commands/notify';
import { isSaved, pickMedia } from '~/commands/media';
import type { DraftMedia } from '~/commands/media';
import type { Tag } from '~/commands/tags';
import { Commands } from '~/commands/modules';

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

	return (
		<Discord.Stack spacing={16}>
			<Discord.TableRowGroupTitle
				title={original ? messages.EDIT_COMMAND : messages.CREATE_COMMAND}
			/>
			<Discord.TextInput
				label={messages.COMMAND_NAME}
				placeholder={messages.COMMAND_NAME_PLACEHOLDER}
				autoCapitalize='none'
				autoCorrect={false}
				value={name}
				onChange={setName}
			/>
			<Discord.TextInput
				label={messages.DESCRIPTION_OPTIONAL}
				placeholder={messages.DESCRIPTION_PLACEHOLDER}
				autoCapitalize='none'
				autoCorrect={false}
				maxLength={MAX_DESCRIPTION_LENGTH}
				value={description}
				onChange={setDescription}
			/>
			<Discord.TextInput
				label={messages.RESPONSE}
				placeholder={format('RESPONSE_PLACEHOLDER')}
				description={format('RESPONSE_HELP')}
				autoCapitalize='none'
				autoCorrect={false}
				multiline
				value={message}
				onChange={setMessage}
			/>
			{detectedArguments.length ? (
				<Discord.Text variant='text-sm/normal' color='text-muted'>
					{format('ARGUMENTS', {
						names: detectedArguments.map((argument) => argument.name).join(', '),
					})}
				</Discord.Text>
			) : null}
			{media.length ? (
				<Discord.TableRowGroup>
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
				</Discord.TableRowGroup>
			) : null}
			<Discord.Button
				variant='secondary'
				text={picking ? messages.OPENING_PHOTOS : messages.ATTACH_MEDIA}
				onPress={() => void addMedia()}
			/>
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
			<Discord.Button variant='tertiary' text={messages.CANCEL} onPress={onClose} />
		</Discord.Stack>
	);
}

export default CommandForm;
