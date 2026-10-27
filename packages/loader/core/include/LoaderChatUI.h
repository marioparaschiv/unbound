#pragma once

#include <optional>
#include <string>

namespace loader::chatui {
struct Rect {
    double x      = 0;
    double y      = 0;
    double width  = 0;
    double height = 0;
};

struct Padding {
    double horizontal = 0;
    double vertical   = 0;
};

constexpr const char *kAvatarViewClass           = "DCDAvatarView";
constexpr const char *kMessageCellClass          = "DCDMessageTableViewCell";
constexpr const char *kAttributedTextViewClass   = "DCDAttributedTextView";
constexpr int         kContentColumnSearchDepth  = 6;
constexpr double      kContentColumnWidthRatio   = 3.0;
constexpr double      kContentColumnMinimumWidth = 100;
constexpr int         kBubbleFrameRetries        = 3;
constexpr double      kPreferencesDelaySeconds   = 0.5;

bool   isMediaViewClass(const std::string &className);
bool   isContentColumn(double candidateWidth, double avatarBranchWidth);
double avatarCornerRadius(std::optional<double> customRadius, double width);
Rect   tightenedFrame(Rect body, double contentWidth);
Rect   bubbleFrame(Rect body, double contentWidth, Padding padding);
}
