import { ADMIN_SEARCH_MAX_LENGTH, ADMIN_SEARCH_MIN_LENGTH } from '@unbound-app/contracts/admin';
import { IconMagnifier } from 'nucleo-micro-bold';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import { Button } from '~/components/ui/button';
import Spinner from '~/components/ui/spinner';

type SearchFormProps = {
	search: string;
	placeholder: string;
	onSearch: (search: string) => void;
	/** Whether the list behind the form still shows the last search while the new one loads. */
	pending?: boolean;
};

function SearchForm({ search, placeholder, onSearch, pending = false }: SearchFormProps) {
	const [value, setValue] = useState(search);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const trimmed = value.trim();

		// `minLength` counts surrounding spaces, which the search contract trims away.
		if (trimmed.length > 0 && trimmed.length < ADMIN_SEARCH_MIN_LENGTH) return;

		onSearch(trimmed);
	}

	return (
		<form onSubmit={submit} className='flex gap-2'>
			<InputGroup className='max-w-sm'>
				<InputGroupAddon>
					<IconMagnifier size={24} />
				</InputGroupAddon>
				<InputGroupInput
					placeholder={placeholder}
					minLength={ADMIN_SEARCH_MIN_LENGTH}
					maxLength={ADMIN_SEARCH_MAX_LENGTH}
					value={value}
					onChange={(event) => setValue(event.target.value)}
				/>
				{pending ? (
					<InputGroupAddon align='inline-end'>
						<Spinner />
					</InputGroupAddon>
				) : null}
			</InputGroup>
			<Button type='submit' variant='secondary'>
				Search
			</Button>
		</form>
	);
}

export default SearchForm;
