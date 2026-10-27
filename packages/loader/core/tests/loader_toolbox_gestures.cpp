#include <cassert>
#include <string>

#include "LoaderToolboxGestures.h"

using namespace loader::toolbox;

static const GestureEnabled kOn = [] {
    return true;
};
static const GestureEnabled kOff = [] {
    return false;
};

static void recognisesShakeMotions()
{
    ShakeMotion motion;
    assert(motion.ended(10, kOn) == GestureAction::None);

    motion.began(10);
    assert(motion.ended(10.4, kOn) == GestureAction::None);
    motion.began(10);
    assert(motion.ended(10.5, kOn) == GestureAction::Open);
    assert(motion.ended(10.6, kOn) == GestureAction::None);
    motion.began(20);
    assert(motion.ended(22, kOn) == GestureAction::Open);
    motion.began(20);
    assert(motion.ended(22.1, kOn) == GestureAction::None);
    motion.began(30);
    assert(motion.ended(31, kOff) == GestureAction::None);
    assert(motion.ended(31, kOn) == GestureAction::None);

    motion.began(40);
    motion.began(41);
    assert(motion.ended(41.6, kOn) == GestureAction::Open);
}

static void recognisesAccelerometerShakes()
{
    const double strong = kStandardGravity * 3;
    const double weak   = kStandardGravity * 2.5;
    ShakeSensor  sensor;

    assert(sensor.sample(strong, 0, 0, 10'000, kOff) == GestureAction::None);
    assert(sensor.sample(weak, 0, 0, 10'000, kOn) == GestureAction::None);
    assert(sensor.sample(strong, 0, 0, 10'000, kOn) == GestureAction::None);
    assert(sensor.sample(0, strong, 0, 10'500, kOn) == GestureAction::Open);

    assert(sensor.sample(strong, 0, 0, 11'000, kOn) == GestureAction::None);
    assert(sensor.sample(strong, 0, 0, 11'999, kOn) == GestureAction::None);
    assert(sensor.sample(strong, 0, 0, 12'000, kOn) == GestureAction::None);
    assert(sensor.sample(strong, 0, 0, 13'000, kOn) == GestureAction::None);
    assert(sensor.sample(strong, 0, 0, 13'900, kOn) == GestureAction::Open);

    assert(sensor.sample(0, 0, strong, 20'000, kOn) == GestureAction::None);
    assert(sensor.sample(0, 0, strong, 20'901, kOn) == GestureAction::None);
    assert(sensor.sample(0, 0, strong, 21'000, kOn) == GestureAction::Open);

    const double diagonal = kStandardGravity * 2.6 / 1.7320508075688772 + 0.001;
    assert(sensor.sample(diagonal, diagonal, diagonal, 30'000, kOn) == GestureAction::None);
    assert(sensor.sample(diagonal, diagonal, diagonal, 30'100, kOn) == GestureAction::Open);
}

static void recognisesThreeFingerHolds()
{
    ThreeFingerPress press;
    assert(press.holdElapsed() == GestureAction::None);
    assert(press.released() == GestureAction::None);

    int                  checks  = 0;
    const GestureEnabled counted = [&checks] {
        checks++;
        return true;
    };
    assert(press.pointerDown(2, counted) == GestureAction::None);
    assert(checks == 0);
    assert(press.pointerDown(3, counted) == GestureAction::StartHold);
    assert(checks == 1);
    assert(press.holdElapsed() == GestureAction::Open);
    assert(press.holdElapsed() == GestureAction::None);

    assert(press.pointerDown(3, kOn) == GestureAction::StartHold);
    assert(press.released() == GestureAction::CancelHold);
    assert(press.holdElapsed() == GestureAction::None);

    assert(press.pointerDown(3, kOff) == GestureAction::None);
    assert(press.pointerDown(4, kOn) == GestureAction::None);
    assert(press.pointerDown(3, kOn) == GestureAction::StartHold);
    assert(press.pointerDown(3, kOn) == GestureAction::StartHold);
    assert(press.released() == GestureAction::CancelHold);
}

static void namesActions()
{
    assert(std::string(gestureActionName(GestureAction::None)) == "none");
    assert(std::string(gestureActionName(GestureAction::Open)) == "open");
    assert(std::string(gestureActionName(GestureAction::StartHold)) == "start-hold");
    assert(std::string(gestureActionName(GestureAction::CancelHold)) == "cancel-hold");
}

int main()
{
    namesActions();
    recognisesShakeMotions();
    recognisesAccelerometerShakes();
    recognisesThreeFingerHolds();
    return 0;
}
