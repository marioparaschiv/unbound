#include <cassert>
#include <cmath>

#include "LoaderDynamicIsland.h"

using namespace loader::dynamicisland;

static bool near(double left, double right, double tolerance = 1e-6)
{
    return std::fabs(left - right) < tolerance;
}

static bool sameFrame(const Frame &left, const Frame &right)
{
    return near(left.x, right.x) && near(left.y, right.y) && near(left.width, right.width) &&
           near(left.height, right.height);
}

static void readsIslandsFromTheSystemCutout()
{
    const Frame proMax{157.333, 14, 125.333, 36.6667};
    const Frame air{147.333, 20, 125.333, 36.6667};
    const Frame smaller{163.5, 14, 86, 30};

    for (const Frame &frame : {proMax, air, smaller})
    {
        const std::optional<Cutout> cutout = cutoutFromSystem(frame);
        assert(cutout && cutout->kind == CutoutKind::Island && sameFrame(cutout->frame, frame));
        assert(near(cornerRadius(*cutout), frame.height / 2));
    }
}

static void readsNotchesFromTheSystemCutout()
{
    const Frame                 notch{90, 0, 210, 32};
    const std::optional<Cutout> cutout = cutoutFromSystem(notch);
    assert(cutout && cutout->kind == CutoutKind::Notch && sameFrame(cutout->frame, notch));
    assert(near(cornerRadius(*cutout), 32 * kNotchCornerRatio));
}

static void readsCameraHolesFromTheSystemCutout()
{
    const Frame                 duoClosed{399, 30, 37, 37};
    const std::optional<Cutout> cutout = cutoutFromSystem(duoClosed);
    assert(cutout && cutout->kind == CutoutKind::Hole && sameFrame(cutout->frame, duoClosed));
    assert(near(cornerRadius(*cutout), 18.5));

    const Frame logo = logoFrame(*cutout);
    assert(near(logo.width, 37 * kHoleLogoRatio * kLogoAspect));
    const double cornerX = logo.x + logo.width - duoClosed.width / 2;
    const double cornerY = logo.y + logo.height - duoClosed.height / 2;
    assert(std::sqrt(cornerX * cornerX + cornerY * cornerY) <= duoClosed.width / 2);
}

static void rejectsMissingCutouts()
{
    assert(!cutoutFromSystem(Frame{0, 0, 0, 0}));
    assert(!cutoutFromSystem(Frame{150, 14, 0, 30}));
    assert(!cutoutFromSystem(std::nullopt));
}

static void fitsTheLogoInsideTheCutout()
{
    const Frame island{157.333, 14, 125.333, 36.6667};
    const Frame logo = logoFrame(Cutout{CutoutKind::Island, island});
    assert(near(logo.height, 36.6667 * kLogoHeightRatio));
    assert(near(logo.width / logo.height, kLogoAspect));
    assert(near(logo.x, (island.width - logo.width) / 2));
    assert(near(logo.y, (island.height - logo.height) / 2));

    const Frame narrow = logoFrame(Cutout{CutoutKind::Island, Frame{100, 14, 20, 18}});
    assert(narrow.width <= 20 + 1e-6 && near(narrow.width / narrow.height, kLogoAspect));
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
    readsIslandsFromTheSystemCutout();
    readsNotchesFromTheSystemCutout();
    readsCameraHolesFromTheSystemCutout();
    rejectsMissingCutouts();
    fitsTheLogoInsideTheCutout();
    startsOnceOnIslandDevices();
    plansShowAndHide();
    return 0;
}
