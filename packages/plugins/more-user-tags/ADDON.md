More User Tags adds a tag next to the author name in a message header. Each author gets one tag, the first enabled tag in this list that applies to them:

- **Webhook**: a message that a webhook sent.
- **Owner**: the author owns the server.
- **Admin**: the author has the Administrator permission.
- **Staff**: the author can manage the server, channels, roles, or webhooks.
- **Mod**: the author can manage messages, kick members, or ban members.
- **VC Mod**: the author can move, mute, or deafen members in voice channels.

The plugin checks permissions with the channel's permission overwrites. Bots get no permission tags. When Discord already shows its original poster label on a message, the label and the plugin's tag share one badge, separated by a dot.

The tag takes the author's role color when they have one. A role with a gradient color gets the gradient behind the tag. Without a role color, each tag has its own color.

## Settings

- **Webhook**, **Owner**, **Admin**, **Staff**, **Mod**, and **VC Mod**: turn each tag on or off. Default on for every tag.
- **Coloured Tags**: gives each tag its own color when the author has no role color. When this is off, those tags keep Discord's default styling. Default on.
- **Use Role Colour**: colors the tag with the author's role color. Default on.
- **Use Enhanced Role Colours**: uses the secondary and tertiary colors of gradient and holographic roles. When this is off, the tag uses only the role's primary color. Default on.
- **Use Original Poster Tag Style**: shows the tag in the style of Discord's original poster badge. Default off.

## Platforms

On iOS, a holographic role color also gets an animated sheen over its gradient. The plugin leaves the sheen out when Reduce Motion is on. Android draws the gradient without the sheen.
