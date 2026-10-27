#include "LoaderChatUI.h"

#include <array>
#include <string_view>

namespace loader::chatui {
static constexpr std::array<std::string_view, 5> kMediaViewClasses = {
    "DiscordChat.MediaMosaicView", "DiscordChat.EmbedView",
    "DiscordChatComponentsSwift.ThumbnailView", "DCDMediaView", "DiscordChat.AttachmentView"};

bool isMediaViewClass(const std::string &className)
{
    for (std::string_view media : kMediaViewClasses)
    {
        if (className == media)
        {
            return true;
        }
    }
    return className.find("Sticker") != std::string::npos;
}

bool isContentColumn(double candidateWidth, double avatarBranchWidth)
{
    return candidateWidth > avatarBranchWidth * kContentColumnWidthRatio &&
           candidateWidth > kContentColumnMinimumWidth;
}

double avatarCornerRadius(std::optional<double> customRadius, double width)
{
    return customRadius ? *customRadius : width / 2.0;
}

Rect tightenedFrame(Rect body, double contentWidth)
{
    if (contentWidth <= 0 || contentWidth >= body.width)
    {
        return body;
    }
    body.width = contentWidth;
    return body;
}

Rect bubbleFrame(Rect body, double contentWidth, Padding padding)
{
    Rect frame = tightenedFrame(body, contentWidth);
    return {frame.x - padding.horizontal, frame.y - padding.vertical,
            frame.width + padding.horizontal * 2, frame.height + padding.vertical * 2};
}
}
