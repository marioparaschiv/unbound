#pragma once

#include <cstdint>
#include <functional>
#include <optional>

namespace loader::toolbox {
constexpr double  kShakeGravity              = 2.6;
constexpr double  kStandardGravity           = 9.80665;
constexpr int64_t kShakeWindowMilliseconds   = 900;
constexpr int64_t kShakeCooldownMilliseconds = 1500;
constexpr int     kThreeFingerPointers       = 3;

enum class GestureAction
{
    None,
    Open,
    StartHold,
    CancelHold,
};

using GestureEnabled = std::function<bool()>;

const char *gestureActionName(GestureAction action);

class ShakeMotion
{
public:
    void          began(double seconds);
    GestureAction ended(double seconds, const GestureEnabled &enabled);

private:
    std::optional<double> start_;
};

class ShakeSensor
{
public:
    GestureAction sample(double x, double y, double z, int64_t milliseconds,
                         const GestureEnabled &enabled);

private:
    int64_t start_ = 0;
    int64_t last_  = 0;
};

class ThreeFingerPress
{
public:
    GestureAction pointerDown(int pointers, const GestureEnabled &enabled);
    GestureAction released();
    GestureAction holdElapsed();

private:
    bool holding_ = false;
};
}
