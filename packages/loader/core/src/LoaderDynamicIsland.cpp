#include "LoaderDynamicIsland.h"

#include <cmath>

namespace loader::dynamicisland {
bool hasDynamicIsland(bool isPhone, std::optional<double> topInset)
{
    return isPhone && topInset && std::fabs(*topInset - kTopInset) < kTopInsetTolerance;
}

Frame overlayFrame(double screenWidth)
{
    return {(screenWidth - kWidth) / 2, kTop, kWidth, kHeight};
}

double cornerRadius()
{
    return kHeight / 2;
}

Frame logoFrame(double logoAspectRatio)
{
    const double height = kHeight * kLogoHeightRatio;
    const double width  = height * logoAspectRatio;
    return {(kWidth - width) / 2, (kHeight - height) / 2, width, height};
}

Start Presentation::start(bool hasIsland)
{
    if (!hasIsland)
    {
        return Start::NoIsland;
    }
    if (started_)
    {
        return Start::AlreadyStarted;
    }
    started_ = true;
    return Start::Started;
}

Plan Presentation::show(const ViewState &view) const
{
    if (!view.exists)
    {
        return {true, true, false};
    }
    if (!view.hidden && view.alpha >= 1.0)
    {
        return {};
    }
    return {false, true, false};
}

Plan Presentation::hide(const ViewState &view) const
{
    if (!view.exists || view.hidden)
    {
        return {};
    }
    return {false, false, true};
}

Plan Presentation::on(Lifecycle event, const ViewState &view) const
{
    return event == Lifecycle::BecameActive ? show(view) : hide(view);
}
}
