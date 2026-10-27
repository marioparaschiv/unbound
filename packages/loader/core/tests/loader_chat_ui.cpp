#include <cassert>

#include "LoaderChatUI.h"

using namespace loader::chatui;

static bool same(const Rect &left, const Rect &right)
{
    return left.x == right.x && left.y == right.y && left.width == right.width &&
           left.height == right.height;
}

int main()
{
    assert(isMediaViewClass("DiscordChat.MediaMosaicView"));
    assert(isMediaViewClass("DiscordChat.EmbedView"));
    assert(isMediaViewClass("DiscordChatComponentsSwift.ThumbnailView"));
    assert(isMediaViewClass("DCDMediaView"));
    assert(isMediaViewClass("DiscordChat.AttachmentView"));
    assert(isMediaViewClass("DiscordChat.StickerView"));
    assert(isMediaViewClass("Sticker"));
    assert(!isMediaViewClass("DCDAttributedTextView"));
    assert(!isMediaViewClass("DCDMediaViewController"));
    assert(!isMediaViewClass(""));

    assert(isContentColumn(301, 100));
    assert(!isContentColumn(300, 100));
    assert(!isContentColumn(100, 10));
    assert(isContentColumn(101, 10));
    assert(!isContentColumn(0, 0));

    assert(avatarCornerRadius(std::nullopt, 40) == 20);
    assert(avatarCornerRadius(6, 40) == 6);
    assert(avatarCornerRadius(0, 40) == 0);

    const Rect body{10, 20, 200, 50};
    assert(same(tightenedFrame(body, 120), {10, 20, 120, 50}));
    assert(same(tightenedFrame(body, 0), body));
    assert(same(tightenedFrame(body, -4), body));
    assert(same(tightenedFrame(body, 200), body));
    assert(same(tightenedFrame(body, 260), body));

    assert(same(bubbleFrame(body, 120, {8, 4}), {2, 16, 136, 58}));
    assert(same(bubbleFrame(body, 0, {8, 4}), {2, 16, 216, 58}));
    assert(same(bubbleFrame(body, 120, {}), {10, 20, 120, 50}));
    return 0;
}
