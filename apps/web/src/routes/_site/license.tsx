import { createFileRoute } from '@tanstack/react-router';

import { ProseItem, ProseList, ProsePage, ProseParagraph, ProseSection } from '~/components/prose';

const CURRENT_YEAR = new Date().getFullYear();

type ExternalLinkProps = {
	href: string;
};

function ExternalLink({ href }: ExternalLinkProps) {
	return (
		<a
			href={href}
			target='_blank'
			rel='noopener noreferrer'
			className='text-link text-sm underline-offset-4 hover:underline'
		>
			{href}
		</a>
	);
}

function LicensePage() {
	return (
		<ProsePage
			title='License'
			description='Unbound is licensed under the GNU General Public License v3.0'
			footer={`Copyright © ${CURRENT_YEAR} Unbound Contributors`}
		>
			<ProseSection title='GNU General Public License v3.0'>
				<ProseParagraph>
					Unbound is free and open-source software licensed under the GNU General Public
					License version 3.0 (GPL-3.0). This license grants you the freedom to use,
					study, share, and modify the software.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Key Permissions'>
				<ProseParagraph>Under the GPL-3.0 license, you are permitted to:</ProseParagraph>
				<ProseList>
					<ProseItem>
						<strong>Use:</strong> Run the software for any purpose, commercial or
						non-commercial
					</ProseItem>
					<ProseItem>
						<strong>Study:</strong> Access and study the source code to understand how
						it works
					</ProseItem>
					<ProseItem>
						<strong>Share:</strong> Distribute copies of the original software to others
					</ProseItem>
					<ProseItem>
						<strong>Modify:</strong> Create modified versions and distribute them to
						others
					</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='Key Conditions'>
				<ProseParagraph>The GPL-3.0 license requires that:</ProseParagraph>
				<ProseList>
					<ProseItem>
						<strong>Disclose Source:</strong> You must make the source code available
						when you distribute the software
					</ProseItem>
					<ProseItem>
						<strong>License and Copyright Notice:</strong> Include a copy of the GPL-3.0
						license and copyright notice with all copies or substantial portions of the
						software
					</ProseItem>
					<ProseItem>
						<strong>Same License:</strong> Modifications and derivative works must also
						be licensed under GPL-3.0
					</ProseItem>
					<ProseItem>
						<strong>State Changes:</strong> Clearly document any changes made to the
						original source code
					</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='No Warranty'>
				<ProseParagraph>
					This software is provided "as is", without warranty of any kind, express or
					implied, including but not limited to the warranties of merchantability, fitness
					for a particular purpose, and noninfringement. In no event shall the authors or
					copyright holders be liable for any claim, damages, or other liability, whether
					in an action of contract, tort, or otherwise, arising from, out of, or in
					connection with the software or the use or other dealings in the software.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='User-Submitted Content'>
				<ProseParagraph>
					While Unbound itself is licensed under GPL-3.0, plugins and themes submitted by
					users may be licensed under different terms at the discretion of their
					respective authors. Each plugin or theme will display its own license
					information. Please review the license of any plugin or theme before using it.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Full License Text'>
				<ProseParagraph>
					You can read the full text of the GNU General Public License v3.0 at:
				</ProseParagraph>
				<ExternalLink href='https://www.gnu.org/licenses/gpl-3.0.en.html' />
			</ProseSection>

			<ProseSection title='Source Code'>
				<ProseParagraph>The source code for Unbound is available on GitHub:</ProseParagraph>
				<ExternalLink href='https://github.com/unbound-app' />
			</ProseSection>

			<ProseSection title='Questions'>
				<ProseParagraph>
					If you have questions about the license or how it applies to your use case,
					please contact us through our Discord server or GitHub repository.
				</ProseParagraph>
			</ProseSection>
		</ProsePage>
	);
}

export const Route = createFileRoute('/_site/license')({
	head: () => ({ meta: [{ title: 'Unbound | License' }] }),
	component: LicensePage,
});
