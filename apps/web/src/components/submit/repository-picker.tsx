import type { PushableRepository } from '@unbound-app/contracts/source';
import { IconMagnifier } from 'nucleo-micro-bold';
import type { FormEvent } from 'react';
import { useId } from 'react';

import { Field, FieldDescription, FieldLabel } from '~/components/ui/field';
import GitHubIcon from '~/components/icons/github';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';

type RepositoryPickerProps = {
	value: string;
	repositories: PushableRepository[];
	disabled: boolean;
	onChange: (value: string) => void;
	onPick: (repository: string) => void;
};

function RepositoryPicker({
	value,
	repositories,
	disabled,
	onChange,
	onPick,
}: RepositoryPickerProps) {
	const id = useId();

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onPick(value);
	}

	return (
		<form onSubmit={submit} className='flex flex-col gap-3'>
			<Field>
				<FieldLabel htmlFor={`${id}-repository`}>Repository</FieldLabel>
				<div className='flex gap-2'>
					<Input
						id={`${id}-repository`}
						value={value}
						onChange={(event) => onChange(event.target.value)}
						placeholder='https://github.com/owner/name'
						disabled={disabled}
						required
					/>
					<Button type='submit' variant='outline' disabled={disabled || !value.trim()}>
						<IconMagnifier size={24} />
						Find addons
					</Button>
				</div>
				<FieldDescription>
					A public GitHub repository you can push to, as a URL or owner/name. The bundle
					must be committed.
				</FieldDescription>
			</Field>

			{repositories.length > 0 ? (
				<div className='flex flex-col gap-1'>
					<Text variant='text-xs' color='muted'>
						Repositories you can push to
					</Text>
					<div className='flex flex-wrap gap-2'>
						{repositories.map((entry) => (
							<Button
								key={entry.repository}
								type='button'
								variant='ghost'
								size='sm'
								disabled={disabled}
								onClick={() => onPick(entry.repository)}
							>
								<GitHubIcon />
								{entry.repository}
							</Button>
						))}
					</div>
				</div>
			) : null}
		</form>
	);
}

export default RepositoryPicker;
