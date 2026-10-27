#pragma once

#include <optional>

namespace loader::dynamicisland {
constexpr double kTopInset           = 59.0;
constexpr double kTopInsetTolerance  = 0.1;
constexpr double kWidth              = 126.0;
constexpr double kHeight             = 37.33;
constexpr double kTop                = 11.0;
constexpr double kLogoHeightRatio    = 0.99;
constexpr double kRevealSeconds      = 0.2;
constexpr double kCreateDelaySeconds = 1.0;
constexpr double kShowDelaySeconds   = 0.5;

struct Frame {
    double x      = 0;
    double y      = 0;
    double width  = 0;
    double height = 0;
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

bool   hasDynamicIsland(bool isPhone, std::optional<double> topInset);
Frame  overlayFrame(double screenWidth);
double cornerRadius();
Frame  logoFrame(double logoAspectRatio);

class Presentation
{
public:
    Start start(bool hasIsland);
    Plan  show(const ViewState &view) const;
    Plan  hide(const ViewState &view) const;
    Plan  on(Lifecycle event, const ViewState &view) const;

private:
    bool started_ = false;
};
}
