import { IconArrowRotateAnticlockwise } from 'nucleo-micro-bold';
import { useId, useState } from 'react';

import { Field, FieldDescription, FieldLabel } from '~/components/ui/field';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';

type ColorFieldProps = {
	label: string;
	description?: string;
	value: string;
	onChange: (value: string) => void;
	/** Shows a reset button, for a colour the user can set over a generated one. */
	onReset?: () => void;
	/** Whether the user set the colour, which enables the reset. */
	edited?: boolean;
};

const HEX = /^#[\da-f]{6}$/;

function normalise(value: string) {
	const hex = value.trim().toLowerCase();

	return hex.startsWith('#') ? hex : `#${hex}`;
}

/**
 * @description A colour picked with the browser's picker or typed as hex; a hex applies once it is complete.
 * @param props The label, the hint, the `#rrggbb` value, the change handler and the optional reset.
 * @returns The field.
 */
function ColorField({
	label,
	description,
	value,
	onChange,
	onReset,
	edited = false,
}: ColorFieldProps) {
	const id = useId();
	const [draft, setDraft] = useState(value);
	const [shown, setShown] = useState(value);

	// A preset or the picker replaces whatever was half-typed.
	if (shown !== value) {
		setShown(value);
		setDraft(value);
	}

	const valid = HEX.test(normalise(draft));

	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<div className='flex gap-2'>
				<label
					className='relative rounded-control ring-1 ring-border ring-inset size-11 overflow-hidden cursor-pointer shrink-0'
					style={{ background: value }}
				>
					<span className='sr-only'>Pick {label}</span>
					<input
						type='color'
						value={value}
						onChange={(event) => onChange(event.target.value)}
						className='absolute inset-0 opacity-0 cursor-pointer'
					/>
				</label>
				<Input
					id={id}
					value={draft}
					spellCheck={false}
					autoComplete='off'
					aria-invalid={!valid}
					className='font-mono'
					onChange={(event) => {
						setDraft(event.target.value);

						const hex = normalise(event.target.value);

						if (HEX.test(hex)) {
							onChange(hex);
						}
					}}
					onBlur={() => setDraft(value)}
				/>
				{onReset ? (
					<Button
						variant='ghost'
						size='icon'
						aria-label={`Reset ${label}`}
						title='Reset to generated'
						className='shrink-0'
						disabled={!edited}
						onClick={onReset}
					>
						<IconArrowRotateAnticlockwise />
					</Button>
				) : null}
			</div>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
		</Field>
	);
}

export default ColorField;
