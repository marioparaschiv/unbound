Chat Bubbles draws a rounded bubble behind each message in chat. The bubble wraps the message's text and media with a small margin. It is translucent black on dark themes and translucent white on the light theme, and it changes when you switch themes. When you stop the plugin, it removes the bubbles.

## Known issues

- The plugin needs native access from the Unbound loader, the Objective-C bridge on iOS and the Java bridge on Android. If the loader does not offer it, the plugin does not start.
- On iOS, a message row without an avatar gets no bubble.
- On iOS, reactions under a message stay outside the bubble.
