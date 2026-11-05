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

static void rejectsMissingCutouts()
{
    assert(!cutoutFromSystem(Frame{0, 0, 0, 0}));
    assert(!cutoutFromSystem(Frame{150, 14, 30, 30}));
    assert(!cutoutFromSystem(std::nullopt));
}

static void fitsTheLogoInsideTheCutout()
{
    const Frame island{157.333, 14, 125.333, 36.6667};
    const Frame logo = logoFrame(island);
    assert(near(logo.height, 36.6667 * kLogoHeightRatio));
    assert(near(logo.width / logo.height, kLogoAspect));
    assert(near(logo.x, (island.width - logo.width) / 2));
    assert(near(logo.y, (island.height - logo.height) / 2));

    const Frame narrow = logoFrame(Frame{100, 14, 30, 30});
    assert(near(narrow.width, 30) && near(narrow.width / narrow.height, kLogoAspect));
}

static void drawsTheLogoLayersInOrder()
{
    const std::vector<Pixel> pixels = logoPixels();

    int  counts[5] = {};
    Ink  previous  = Ink::Shadow;
    bool ordered   = true;
    for (const Pixel &pixel : pixels)
    {
        counts[static_cast<int>(pixel.ink)]++;
        ordered  = ordered && static_cast<int>(pixel.ink) >= static_cast<int>(previous);
        previous = pixel.ink;
    }

    assert(ordered);
    assert(counts[static_cast<int>(Ink::White)] == 140);
    assert(counts[static_cast<int>(Ink::Shadow)] == 140);
    assert(counts[static_cast<int>(Ink::Red)] == 24);
    assert(counts[static_cast<int>(Ink::Cyan)] == 24);

    bool hasCornerCell = false;
    bool hasSparkle    = false;
    for (const Pixel &pixel : pixels)
    {
        if (pixel.ink != Ink::White)
        {
            continue;
        }
        hasCornerCell =
            hasCornerCell || (near(pixel.frame.x, 39.6, 0.02) && near(pixel.frame.y, 116.15, 0.02));
        hasSparkle = hasSparkle || sameFrame(pixel.frame, Frame{192.82, 64.84, 8.73, 8.73});
    }
    assert(hasCornerCell && hasSparkle);

    for (const Pixel &pixel : pixels)
    {
        if (pixel.ink == Ink::Scanline && near(pixel.frame.x, 39.6, 0.02) &&
            near(pixel.frame.y, 116.15, 0.02))
        {
            assert(near(pixel.frame.height, 1.45, 0.02));
        }
        assert(pixel.frame.x >= kLogoMinX - 1e-6 && pixel.frame.y >= kLogoMinY - 1e-6);
        assert(pixel.frame.x + pixel.frame.width <= kLogoMinX + kLogoWidth + 1e-6);
        assert(pixel.frame.y + pixel.frame.height <= kLogoMinY + kLogoHeight + 1e-6);
    }
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
    rejectsMissingCutouts();
    fitsTheLogoInsideTheCutout();
    drawsTheLogoLayersInOrder();
    startsOnceOnIslandDevices();
    plansShowAndHide();
    return 0;
}
