#include <cassert>
#include <cmath>

#include "LoaderDynamicIsland.h"

using namespace loader::dynamicisland;

static bool near(double left, double right)
{
    return std::fabs(left - right) < 1e-9;
}

static void detectsTheIslandFromTheTopInset()
{
    assert(hasDynamicIsland(true, 59.0));
    assert(hasDynamicIsland(true, 59.09));
    assert(hasDynamicIsland(true, 58.91));
    assert(!hasDynamicIsland(true, 59.1));
    assert(!hasDynamicIsland(true, 47.0));
    assert(!hasDynamicIsland(true, 20.0));
    assert(!hasDynamicIsland(true, std::nullopt));
    assert(!hasDynamicIsland(false, 59.0));
}

static void placesTheOverlayOverTheIsland()
{
    const Frame frame = overlayFrame(393);
    assert(near(frame.x, 133.5) && near(frame.y, 11) && near(frame.width, 126) &&
           near(frame.height, 37.33));
    assert(near(overlayFrame(430).x, 152));
    assert(near(cornerRadius(), 18.665));

    const Frame square = logoFrame(1.0);
    assert(near(square.height, 37.33 * 0.99) && near(square.width, square.height));
    assert(near(square.x, (126 - square.width) / 2) && near(square.y, (37.33 - square.height) / 2));
    const Frame wide = logoFrame(2.0);
    assert(near(wide.width, wide.height * 2));
}

static void startsOnceOnIslandDevices()
{
    Presentation presentation;
    assert(presentation.start(false) == Start::NoIsland);
    assert(presentation.start(true) == Start::Started);
    assert(presentation.start(true) == Start::AlreadyStarted);
    assert(presentation.start(false) == Start::NoIsland);
}

static void plansShowAndHide()
{
    const Presentation presentation;
    const ViewState    missing{};
    const ViewState    hidden{true, true, 0};
    const ViewState    fading{true, false, 0.4};
    const ViewState    visible{true, false, 1};

    Plan plan = presentation.show(missing);
    assert(plan.create && plan.reveal && !plan.conceal);
    plan = presentation.show(hidden);
    assert(!plan.create && plan.reveal);
    plan = presentation.show(fading);
    assert(!plan.create && plan.reveal);
    plan = presentation.show(visible);
    assert(!plan.create && !plan.reveal && !plan.conceal);

    assert(!presentation.hide(missing).conceal);
    assert(!presentation.hide(hidden).conceal);
    assert(presentation.hide(fading).conceal);
    assert(presentation.hide(visible).conceal);

    assert(presentation.on(Lifecycle::BecameActive, hidden).reveal);
    assert(presentation.on(Lifecycle::WillResignActive, visible).conceal);
    assert(!presentation.on(Lifecycle::WillResignActive, visible).reveal);
}

int main()
{
    detectsTheIslandFromTheTopInset();
    placesTheOverlayOverTheIsland();
    startsOnceOnIslandDevices();
    plansShowAndHide();
    return 0;
}
