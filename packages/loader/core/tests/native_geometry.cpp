#include <cassert>
#include <limits>
#include <stdexcept>

#include "NativeGeometry.h"

using namespace loader::native;

template <typename Parse> static bool rejects(Parse parse)
{
    try
    {
        parse();
    }
    catch (const std::invalid_argument &)
    {
        return true;
    }
    return false;
}

int main()
{
    NativeFrame frame = parseFrame({{"x", -20.5}, {"y", 40}, {"width", 320}, {"height", 0}});
    assert(frame.x == -20.5 && frame.y == 40 && frame.width == 320 && frame.height == 0);
    assert(toJSON(frame) ==
           nlohmann::json({{"x", -20.5}, {"y", 40}, {"width", 320}, {"height", 0}}));

    NativeSize size = parseSize({{"width", 32768}, {"height", 1}});
    assert(size.width == 32768 && size.height == 1);
    assert(toJSON(size) == nlohmann::json({{"width", 32768}, {"height", 1}}));

    double infinity = std::numeric_limits<double>::infinity();
    double nan      = std::numeric_limits<double>::quiet_NaN();

    assert(rejects([&] {
        parseSize({{"width", -1}, {"height", 10}});
    }));
    assert(rejects([&] {
        parseSize({{"width", 32769}, {"height", 10}});
    }));
    assert(rejects([&] {
        parseSize({{"width", nan}, {"height", 10}});
    }));
    assert(rejects([&] {
        parseSize({{"width", 10}});
    }));
    assert(rejects([&] {
        parseSize({{"width", "10"}, {"height", 10}});
    }));
    assert(rejects([&] {
        parseSize(nlohmann::json::array());
    }));
    assert(rejects([&] {
        parseFrame({{"x", infinity}, {"y", 0}, {"width", 1}, {"height", 1}});
    }));
    assert(rejects([&] {
        parseFrame({{"x", 0}, {"y", 100001}, {"width", 1}, {"height", 1}});
    }));
    assert(rejects([&] {
        parseFrame({{"x", -100001}, {"y", 0}, {"width", 1}, {"height", 1}});
    }));
    assert(rejects([&] {
        parseFrame({{"x", 0}, {"y", 0}, {"width", 1}, {"height", -0.5}});
    }));
    assert(rejects([&] {
        parseFrame(nlohmann::json(nullptr));
    }));
    assert(!rejects([&] {
        parseFrame({{"x", 100000}, {"y", -100000}, {"width", 0}, {"height", 32768}});
    }));
}
