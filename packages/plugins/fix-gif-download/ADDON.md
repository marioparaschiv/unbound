Discord often plays a GIF as a video, and saving it gives you that video file. Fix GIF Downloads makes Discord save the GIF file instead. It changes the share and save actions in Discord's media viewer and the download that Discord's media manager runs.

The plugin finds the GIF address for Tenor, Giphy, and Klipy media, including links that Discord wraps in its external media proxy. For Tenor and Giphy it builds the GIF address from the video address. For animated images from Discord's own media proxy, it asks the proxy for the GIF format.

## Known issues

- Klipy uses different addresses for its video and its GIF, so the plugin searches the Klipy API (`api.klipy.com`) for the GIF. The search sends the name from the GIF's Klipy page link, or the GIF's title. The plugin starts this search when Klipy media shows in chat, before you save it, so the save does not wait.
- If no Klipy search result matches the media, or the search fails, the plugin saves Discord's own file.
