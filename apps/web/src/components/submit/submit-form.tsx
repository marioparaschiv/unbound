import type { Submission } from '@unbound-app/contracts/publish';
import { repositorySchema } from '@unbound-app/contracts/source';
import { useId, useState, useTransition } from 'react';
import { IconUpload } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { FormEvent } from 'react';

import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field';
import { createBrowserClient } from '~/lib/api/browser-client';
import { readArtifactManifest } from '~/lib/addon-artifact';
import getApiErrorMessage from '~/lib/api/error-message';
import { publishArtifact } from '~/api/publish';
import { Button } from '~/components/ui/button';
import Textarea from '~/components/ui/textarea';
import Input from '~/components/ui/input';

type SubmitFormProps = {
	githubLinked: boolean;
	/** Restricts the form to this addon's manifest, when republishing it. */
	addonId?: string;
	onSubmitted: (submission: Submission) => void;
};

type FormErrors = {
	manifest?: string;
	repository?: string;
	/** The server's refusal, e.g. a spam gate or the size limit. */
	submit?: string;
};

function SubmitForm({ githubLinked, addonId, onSubmitted }: SubmitFormProps) {
	const id = useId();
	const [manifestFile, setManifestFile] = useState<File | null>(null);
	const [bundleFile, setBundleFile] = useState<File | null>(null);
	const [repository, setRepository] = useState('');
	const [changelog, setChangelog] = useState('');
	const [errors, setErrors] = useState<FormErrors>({});
	const [isPending, startTransition] = useTransition();

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!manifestFile || !bundleFile) return;

		const repo = repository.trim();
		const parsedRepository = repo ? repositorySchema.safeParse(repo) : null;

		startTransition(async () => {
			const read = readArtifactManifest(await manifestFile.text(), bundleFile.name, addonId);
			const next: FormErrors = {
				manifest: read.success ? undefined : read.error,
				repository: parsedRepository?.error?.issues[0]?.message,
			};

			setErrors(next);

			if (!read.success || next.repository) return;

			try {
				const submission = await publishArtifact(createBrowserClient(), {
					manifest: read.manifest,
					bundle: bundleFile,
					repository: repo || undefined,
					changelog: changelog.trim() || undefined,
				});

				onSubmitted(submission);
			} catch (error) {
				setErrors({ submit: getApiErrorMessage(error) });
			}
		});
	}

	return (
		<form onSubmit={submit}>
			<FieldGroup>
				<Field data-invalid={Boolean(errors.manifest)}>
					<FieldLabel htmlFor={`${id}-manifest`}>Manifest *</FieldLabel>
					<Input
						id={`${id}-manifest`}
						type='file'
						accept='.json,application/json'
						onChange={(event) => setManifestFile(event.target.files?.[0] ?? null)}
						aria-invalid={Boolean(errors.manifest)}
						disabled={isPending}
						required
					/>
					<FieldDescription>
						{addonId
							? `The manifest.json of ${addonId}, with the changes reviewers asked for.`
							: 'Your addon’s manifest.json.'}
					</FieldDescription>
					<FieldError className='whitespace-pre-wrap'>{errors.manifest}</FieldError>
				</Field>

				<Field>
					<FieldLabel htmlFor={`${id}-bundle`}>Bundle *</FieldLabel>
					<Input
						id={`${id}-bundle`}
						type='file'
						onChange={(event) => setBundleFile(event.target.files?.[0] ?? null)}
						disabled={isPending}
						required
					/>
					<FieldDescription>
						The file ubd build wrote for the addon. It is published as the manifest’s
						main.
					</FieldDescription>
				</Field>

				<Field data-invalid={Boolean(errors.repository)}>
					<FieldLabel htmlFor={`${id}-repository`}>Source repository</FieldLabel>
					<Input
						id={`${id}-repository`}
						value={repository}
						onChange={(event) => setRepository(event.target.value)}
						placeholder='owner/name'
						aria-invalid={Boolean(errors.repository)}
						disabled={isPending || !githubLinked}
					/>
					<FieldDescription>
						{githubLinked ? (
							'Optional. The GitHub repository the addon is built from; you need push access to it. Without one, reviewers see the source as unverified.'
						) : (
							<>
								Submitting from a GitHub repository needs a linked GitHub account.{' '}
								<Link to='/account'>Link GitHub</Link> to name one; without it,
								reviewers see the source as unverified.
							</>
						)}
					</FieldDescription>
					<FieldError>{errors.repository}</FieldError>
				</Field>

				<Field>
					<FieldLabel htmlFor={`${id}-changelog`}>Changelog</FieldLabel>
					<Textarea
						id={`${id}-changelog`}
						value={changelog}
						onChange={(event) => setChangelog(event.target.value)}
						placeholder='What changed in this version...'
						disabled={isPending}
					/>
				</Field>

				<FieldError>{errors.submit}</FieldError>

				<Button type='submit' disabled={isPending} className='w-full md:w-auto'>
					<IconUpload />
					{isPending ? 'Submitting...' : 'Submit for Review'}
				</Button>
			</FieldGroup>
		</form>
	);
}

export default SubmitForm;
