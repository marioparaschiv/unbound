import { createFileRoute } from '@tanstack/react-router';

import { ProseItem, ProseList, ProsePage, ProseParagraph, ProseSection } from '~/components/prose';

const LAST_UPDATED = 'October 17, 2026';

function PrivacyPage() {
	return (
		<ProsePage
			title='Privacy Policy'
			description='Your privacy and our commitment to transparency.'
			footer={`Last updated: ${LAST_UPDATED}`}
		>
			<ProseSection title='Information We Collect'>
				<ProseParagraph>
					When you create an account or use certain features of Unbound, we collect and
					store the following information:
				</ProseParagraph>
				<ProseList>
					<ProseItem>
						<strong>Account Information:</strong> Username and authentication
						credentials
					</ProseItem>
					<ProseItem>
						<strong>OAuth Credentials:</strong> If you sign in using GitHub or Discord,
						we store OAuth tokens and profile information (such as username, avatar, and
						user ID) to validate that the account belongs to you and maintain your
						authenticated session
					</ProseItem>
					<ProseItem>
						<strong>Profile Information:</strong> Display name, avatar, and other
						profile details you provide or obtained through OAuth providers
					</ProseItem>
					<ProseItem>
						<strong>Submission Data:</strong> Plugins, themes, and related content you
						submit for approval, including descriptions, screenshots, source code, and
						metadata
					</ProseItem>
					<ProseItem>
						<strong>Usage Data:</strong> Information about your interactions with the
						platform, such as downloads, favorites, and reviews
					</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='Authentication & Cookies'>
				<ProseParagraph>
					We store session cookies in your browser to keep you logged in. These cookies
					are essential for the functionality of the platform and are not used for
					tracking purposes. Session cookies expire after a period of inactivity or when
					you log out.
				</ProseParagraph>
				<ProseParagraph>
					When you authenticate using GitHub or Discord via OAuth, we receive and store
					OAuth access tokens to verify your identity and maintain your connection to
					these services. These tokens are securely stored and only used for
					authentication purposes.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='How We Use Your Information'>
				<ProseParagraph>
					We use the information we collect for the following purposes:
				</ProseParagraph>
				<ProseList>
					<ProseItem>
						To provide and maintain our services, including user authentication and
						account management
					</ProseItem>
					<ProseItem>
						To verify your identity and ensure the security of your account through
						OAuth providers
					</ProseItem>
					<ProseItem>
						To review, approve, and publish user-submitted plugins and themes
					</ProseItem>
					<ProseItem>
						To communicate with you about your submissions, account, or platform updates
					</ProseItem>
					<ProseItem>To improve our services and develop new features</ProseItem>
					<ProseItem>
						To prevent abuse, spam, and violations of our terms of service
					</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='Data Retention'>
				<ProseParagraph>
					We retain your account information and submitted content for as long as your
					account is active. If you delete your account, we will remove your personal
					information and OAuth credentials, though submitted plugins and themes may
					remain publicly available if they have been approved and published. You can
					request deletion of your content by contacting us.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='No Analytics or Third-Party Tracking'>
				<ProseParagraph>
					We do not use analytics services, advertising networks, or third-party tracking
					technologies to monitor your behavior. The only cookies we use are essential
					session cookies for authentication purposes. We do not sell or share your data
					with third parties for marketing purposes.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Third-Party Services'>
				<ProseParagraph>
					While Unbound itself does not collect data, please be aware that any plugins or
					themes you install may have their own data collection practices. We encourage
					you to review the privacy policies of individual plugins and themes before
					installation.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Client Modification Disclaimer'>
				<ProseParagraph>
					Unbound is a client modification for Discord. By using Unbound, you acknowledge
					and accept the following:
				</ProseParagraph>
				<ProseList>
					<ProseItem>
						Using client modifications violates Discord's Terms of Service
					</ProseItem>
					<ProseItem>
						Discord may suspend or terminate accounts that use client modifications
					</ProseItem>
					<ProseItem>
						We are not liable for any account suspensions, bans, or other actions taken
						by Discord
					</ProseItem>
					<ProseItem>Use of Unbound is entirely at your own risk</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='Limitation of Liability'>
				<ProseParagraph>
					Unbound and its developers are not responsible for any consequences resulting
					from your use of this software, including but not limited to account
					suspensions, data loss, or service interruptions. By using Unbound, you agree to
					hold us harmless from any claims or damages.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Updates to This Policy'>
				<ProseParagraph>
					We may update this privacy policy from time to time. Any changes will be posted
					on this page with an updated revision date. Your continued use of Unbound after
					any changes constitutes acceptance of the updated policy.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Contact'>
				<ProseParagraph>
					If you have any questions about this privacy policy, please contact us through
					our Discord server or GitHub repository.
				</ProseParagraph>
			</ProseSection>
		</ProsePage>
	);
}

export const Route = createFileRoute('/_site/privacy')({
	head: () => ({ meta: [{ title: 'Unbound | Privacy Policy' }] }),
	component: PrivacyPage,
});
