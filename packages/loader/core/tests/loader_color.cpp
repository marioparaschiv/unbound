#include "LoaderColor.h"

#include <cassert>

int main()
{
    assert(loader::toARGB(*loader::parseColor("#FF0000")) == 0xFFFF0000);
    assert(loader::toARGB(*loader::parseColor("#00FF0080")) == 0x8000FF00);
    assert(loader::toARGB(*loader::parseColor("#abc")) == 0xFFAABBCC);
    assert(loader::toARGB(*loader::parseColor("rgba(0, 0, 255, 0.5)")) == 0x800000FF);
    assert(loader::toARGB(*loader::parseColor(" rgb(16,32,48) ")) == 0xFF102030);
    assert(!loader::parseColor("#12345"));
    assert(!loader::parseColor("blue"));
    assert(!loader::parseColor("rgba(1,2)"));
    assert(loader::isDarkColor(*loader::parseColor("#313338")));
    assert(loader::isDarkColor(*loader::parseColor("#000000")));
    assert(!loader::isDarkColor(*loader::parseColor("#FFFFFF")));
    assert(!loader::isDarkColor(*loader::parseColor("#FBFBFB")));
    return 0;
}
