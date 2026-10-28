#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <string>

#include "NativeStructLayouts.h"

namespace jsi = facebook::jsi;

static void require(bool condition, const std::string &check)
{
    if (!condition)
    {
        std::fprintf(stderr, "native struct layout check failed: %s\n", check.c_str());
        std::exit(1);
    }
}

struct Rect {
    double x, y, width, height;
};

struct Range {
    uint64_t location, length;
};

int main()
{
    auto runtime = facebook::hermes::makeHermesRuntime();

    require(loader::native::structLayoutForTypeName("{CGRect={CGPoint=dd}{CGSize=dd}}") ==
                loader::native::structLayout("CGRect"),
            "a CGRect encoding resolves to CGRect, not the CGPoint inside it");
    require(loader::native::structLayoutForTypeName("_NSRange") ==
                loader::native::structLayout("NSRange"),
            "the _NSRange type name resolves to NSRange");
    require(loader::native::structLayout("CGVector") == nullptr, "an unknown struct has no layout");

    for (const char *name :
         {"NSRange", "CGPoint", "CGSize", "CGRect", "UIEdgeInsets", "CGAffineTransform"})
    {
        const loader::native::StructLayout *layout = loader::native::structLayout(name);
        require(layout && !layout->fields.empty(), std::string(name) + " has a layout");
        size_t end = 0;
        for (const auto &field : layout->fields)
        {
            end = std::max(end, field.offset + 8);
        }
        require(end == layout->size, std::string(name) + "'s fields fill its size");
    }

    Rect       rect{1.5, 2.5, 300, 44};
    jsi::Value converted =
        loader::native::structToJS(*runtime, *loader::native::structLayout("CGRect"),
                                   reinterpret_cast<const uint8_t *>(&rect));
    runtime->global().setProperty(*runtime, "rect", converted);
    jsi::Value shape = runtime->evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>("JSON.stringify(rect)"), "shape.js");
    require(shape.getString(*runtime).utf8(*runtime) ==
                R"({"origin":{"x":1.5,"y":2.5},"size":{"width":300,"height":44}})",
            "a CGRect becomes nested origin and size objects");

    std::vector<uint8_t> bytes =
        loader::native::structFromJS(*runtime, *loader::native::structLayout("CGRect"), converted);
    Rect back{};
    std::memcpy(&back, bytes.data(), sizeof(back));
    require(back.x == 1.5 && back.y == 2.5 && back.width == 300 && back.height == 44,
            "a CGRect round-trips through JavaScript");

    jsi::Value range = runtime->evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>("({ location: 4, length: 9 })"), "range.js");
    std::vector<uint8_t> rangeBytes =
        loader::native::structFromJS(*runtime, *loader::native::structLayout("NSRange"), range);
    Range parsed{};
    std::memcpy(&parsed, rangeBytes.data(), sizeof(parsed));
    require(parsed.location == 4 && parsed.length == 9, "an NSRange is written as unsigned longs");

    bool rejected = false;
    try
    {
        loader::native::structFromJS(*runtime, *loader::native::structLayout("CGSize"),
                                     jsi::Value(3));
    }
    catch (const std::invalid_argument &)
    {
        rejected = true;
    }
    require(rejected, "fields that are not an object are rejected");

    std::printf("native struct layouts: all checks passed on Hermes\n");
    return 0;
}
