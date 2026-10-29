ReviewDB adds a **View Reviews** button under the user info card on a profile. Tap it to open a sheet with the reviews other people left for that user on ReviewDB. Each review shows the author's avatar and name, the date, the text, and a score with up and down arrows. The sheet shortens reviews longer than 200 characters and adds a **Read more** link.

To write reviews and vote, sign in to ReviewDB. Tap **Sign in to leave a review** in the sheet, or **Authorize with ReviewDB** in the plugin settings. Sign-in opens Discord's authorize screen for the ReviewDB app with the `identify` scope. After you sign in, the sheet has a box to review the user in up to 1000 characters. You can leave one review per profile, and a new review replaces your old one. You cannot review your own profile.

Long-press a review to see its actions. You can report reviews that other people wrote. You can delete your own reviews and any review on your own profile, after a second tap on **Confirm delete**. On your own profile, you can also block a review's author so that they cannot review you again.

When you start Discord while signed in, the plugin shows the toast "You have new reviews on your profile!" if your profile got new reviews since the last check.

## Settings

- **Authorize with ReviewDB** signs you in to ReviewDB. After sign-in, the row reads **Reauthorize with ReviewDB**.
- **View My Reviews** opens the review sheet for your own profile.
- **Manage Blocked Users** lists the users you blocked from reviewing you, each with an **Unblock** button. You must be signed in to use it.
- **Notify About New Reviews** shows the new-reviews toast on startup. On by default.
- **Hide Timestamps** hides the date on each review. Off by default.
- **Hide Reviews From Blocked Users** hides reviews written by users you blocked on Discord. On by default.
- **ReviewDB Website** and **ReviewDB Support Server** open the ReviewDB website and its Discord server.

## Known issues

- The plugin uses the ReviewDB service at `manti.vendicated.dev`. Each time you open a review sheet, it sends the profile's Discord ID to ReviewDB. When you are signed in, it also sends your ReviewDB token, and it sends your reviews, votes, reports, and blocks.
- The plugin saves your ReviewDB token in its settings on this device.
- If the plugin cannot find Discord's profile card, the **View Reviews** button does not appear.
