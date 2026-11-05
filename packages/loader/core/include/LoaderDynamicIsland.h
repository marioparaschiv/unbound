#pragma once

#include <optional>

namespace loader::dynamicisland {
constexpr double kLogoHeightRatio    = 0.92;
constexpr double kNotchCornerRatio   = 0.65;
constexpr double kHoleLogoRatio      = 0.6;
constexpr double kRevealSeconds      = 0.2;
constexpr double kCreateDelaySeconds = 1.0;
constexpr double kShowDelaySeconds   = 0.5;

constexpr double kLogoMinX   = 37.0;
constexpr double kLogoMinY   = 54.83;
constexpr double kLogoWidth  = 191.19;
constexpr double kLogoHeight = 152.94;
constexpr double kLogoAspect = kLogoWidth / kLogoHeight;

struct Frame {
    double x      = 0;
    double y      = 0;
    double width  = 0;
    double height = 0;
};

enum class CutoutKind
{
    Island,
    Notch,
    Hole,
};

struct Cutout {
    CutoutKind kind;
    Frame      frame;
};

struct ViewState {
    bool   exists = false;
    bool   hidden = true;
    double alpha  = 0;
};

struct Plan {
    bool create  = false;
    bool reveal  = false;
    bool conceal = false;
};

enum class Start
{
    NoIsland,
    AlreadyStarted,
    Started,
};

enum class Lifecycle
{
    BecameActive,
    WillResignActive,
};

std::optional<Cutout> cutoutFromSystem(std::optional<Frame> rect);
double                cornerRadius(const Cutout &cutout);
Frame                 logoFrame(const Cutout &cutout);

class Presentation
{
public:
    Start start(bool hasCutout);
    Plan  show(const ViewState &view) const;
    Plan  hide(const ViewState &view) const;
    Plan  on(Lifecycle event, const ViewState &view) const;

private:
    bool started_ = false;
};
}
