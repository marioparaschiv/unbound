#include <cassert>

#include "LoaderDevOverlay.h"

using namespace loader::devoverlay;

static bool same(const Frame &left, const Frame &right)
{
    return left.x == right.x && left.y == right.y && left.width == right.width &&
           left.height == right.height;
}

int main()
{
    assert(same(buttonFrame({100, 200}), {78, 178, 44, 44}));
    assert(same(buttonFrame({0, 0}), {-22, -22, 44, 44}));

    const Frame screen{0, 0, 375, 667};
    assert(same(collapsedWindowFrame({100, 200}, screen), {70, 170, 60, 60}));
    assert(same(collapsedWindowFrame({22, 22}, screen), {0, 0, 52, 52}));
    assert(same(collapsedWindowFrame({353, 645}, screen), {323, 615, 52, 52}));
    assert(same(collapsedWindowFrame({-30, 300}, screen), {0, 270, 0, 60}));
    assert(same(collapsedWindowFrame({-100, 300}, screen), {-130, 270, 60, 60}));
    assert(same(collapsedWindowFrame({100, 200}, {50, 50, 100, 100}), {70, 170, 60, 60}));
    assert(same(collapsedWindowFrame({100, 120}, {50, 50, 100, 100}), {70, 90, 60, 60}));
    return 0;
}
