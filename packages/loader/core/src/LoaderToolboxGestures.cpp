#include "LoaderToolboxGestures.h"

#include <cmath>

#include "LoaderToolbox.h"

namespace loader::toolbox {
const char *gestureActionName(GestureAction action)
{
    switch (action)
    {
        case GestureAction::None:
            return "none";
        case GestureAction::Open:
            return "open";
        case GestureAction::StartHold:
            return "start-hold";
        case GestureAction::CancelHold:
            return "cancel-hold";
    }
    return "none";
}

void ShakeMotion::began(double seconds)
{
    start_ = seconds;
}

GestureAction ShakeMotion::ended(double seconds, const GestureEnabled &enabled)
{
    if (!start_)
    {
        return GestureAction::None;
    }
    const double duration = seconds - *start_;
    start_.reset();
    return enabled() && isShakeGesture(duration) ? GestureAction::Open : GestureAction::None;
}

GestureAction ShakeSensor::sample(double x, double y, double z, int64_t milliseconds,
                                  const GestureEnabled &enabled)
{
    if (!enabled())
    {
        return GestureAction::None;
    }
    const double force = std::sqrt(x * x + y * y + z * z) / kStandardGravity;
    if (force < kShakeGravity || milliseconds - last_ < kShakeCooldownMilliseconds)
    {
        return GestureAction::None;
    }
    if (start_ == 0 || milliseconds - start_ > kShakeWindowMilliseconds)
    {
        start_ = milliseconds;
        return GestureAction::None;
    }
    start_ = 0;
    last_  = milliseconds;
    return GestureAction::Open;
}

GestureAction ThreeFingerPress::pointerDown(int pointers, const GestureEnabled &enabled)
{
    if (pointers != kThreeFingerPointers || !enabled())
    {
        return GestureAction::None;
    }
    holding_ = true;
    return GestureAction::StartHold;
}

GestureAction ThreeFingerPress::released()
{
    if (!holding_)
    {
        return GestureAction::None;
    }
    holding_ = false;
    return GestureAction::CancelHold;
}

GestureAction ThreeFingerPress::holdElapsed()
{
    if (!holding_)
    {
        return GestureAction::None;
    }
    holding_ = false;
    return GestureAction::Open;
}
}
