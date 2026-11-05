#include "LoaderDynamicIsland.h"

#include <algorithm>
#include <cmath>

namespace loader::dynamicisland {
std::optional<Cutout> cutoutFromSystem(std::optional<Frame> rect)
{
    if (!rect || rect->width <= 0 || rect->height <= 0)
    {
        return std::nullopt;
    }
    if (rect->y <= 0)
    {
        return Cutout{CutoutKind::Notch, *rect};
    }
    const CutoutKind kind = rect->width > rect->height ? CutoutKind::Island : CutoutKind::Hole;
    return Cutout{kind, *rect};
}

double cornerRadius(const Cutout &cutout)
{
    const Frame &frame = cutout.frame;
    switch (cutout.kind)
    {
        case CutoutKind::Notch:
            return frame.height * kNotchCornerRatio;
        case CutoutKind::Hole:
            return std::min(frame.width, frame.height) / 2;
        case CutoutKind::Island:
            break;
    }
    return frame.height / 2;
}

Frame logoFrame(const Cutout &cutout)
{
    const Frame &frame  = cutout.frame;
    const double ratio  = cutout.kind == CutoutKind::Hole ? kHoleLogoRatio : kLogoHeightRatio;
    const double height = std::min(frame.width, frame.height) * ratio;
    const double width  = std::min(height * kLogoAspect, frame.width);
    const double fitted = width / kLogoAspect;
    return {(frame.width - width) / 2, (frame.height - fitted) / 2, width, fitted};
}

Start Presentation::start(bool hasCutout)
{
    if (!hasCutout)
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
