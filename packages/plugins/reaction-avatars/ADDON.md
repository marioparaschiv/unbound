Reaction Avatars shows the profile pictures of the people who reacted, inside each reaction on a message. The plugin shows up to five faces per reaction. If more people reacted, a `+N` badge after the faces gives the count of the rest. The reaction widens to fit the faces, and the row of reactions wraps again to make room.

Tap a face to open that person's profile. The tap does not add or remove your reaction. The faces cover both normal reactions and super reactions.

The faces update when someone adds or removes a reaction. On iOS, the plugin also loads the faces again after Discord reconnects.

## Known issues

- The plugin asks Discord for the list of people who reacted, one request per reaction it shows. It runs at most three requests at a time and keeps each list for one minute.
- On iOS, if Discord answers with nobody right after a reaction, the plugin asks again up to two more times.
- The plugin needs native features from the Unbound loader. If the loader does not offer one of them, the plugin does not start.
