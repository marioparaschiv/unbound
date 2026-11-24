---
media:
    - image: media/messages.jpg
      alt: Platform Indicators showing each author's platforms after the message timestamp.
    - image: media/profile.jpg
      alt: Platform Indicators showing eternal's desktop and mobile icons, coloured by status, on their profile.
    - image: media/settings.jpg
      alt: Platform Indicators' settings for where icons show and the mobile status shape.
---

## :sparkle: What it does

- :mobile: Shows icons for every platform someone is online on: desktop, mobile, web, console or game (embedded) and VR.
- :palette: Each icon takes the color of that platform's status, so a user online on desktop and idle on mobile shows a green screen and a yellow phone.
- :users: In the member list, and in Discord's other user lists, the icons sit right after the name.
- :circle-user: On profiles, they sit under the name, tag and badges. Tap one to see which platform it stands for.
- :msg: In messages, the timestamp ends with the author's platforms, such as "Today at 12:00 • Desktop, Mobile". Screen readers hear "Online on Desktop and Mobile".
- :user: Your own platforms come from your active sessions, so they show too. Bots have none.
- :mobile: Discord's status dot can show its phone shape for mobile users who are idle or busy, not only for those who are online.
- :code-fork: A port of Vencord's PlatformIndicators.

## :gear: Settings

Every switch is on by default and applies straight away, with no restart.

- :eye: **Show Indicators**: **Member List**, **Profiles** and **Messages**.
- :mobile: **Status**: **Color Mobile Indicator** shows the phone shape whatever the mobile user's status is.

## :circle-info: Differences from Vencord

- :msg: Discord's mobile app draws message headers natively, so there is no space for colored icons there. Messages name the platforms after the timestamp instead, in its own grey text. A long name or tag cuts off the end of the timestamp to keep the header on one line.
- :refresh: A message header updates when Discord redraws the message, not the moment someone's presence changes. The member list and profiles update live.
- :pointer: Mobile has no hover tooltips. Profiles show the platform name when you tap an icon. The member list keeps taps for opening the profile, and screen readers read out the platforms.
