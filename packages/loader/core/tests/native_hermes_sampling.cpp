#include <cassert>
#include <string>

#include "HermesSampling.h"

int main()
{
    std::string trace =
        "{\"traceEvents\":[],\"stackFrames\":{\"1\":{\"name\":\"[root]\",\"category\":\"r"
        "oot\"},\"2\":{\"name\":\"start(plugin:1:10)\",\"category\":\"JavaScript\",\"pare"
        "nt\":\"1\"},\"3\":{\"name\":\"spin(plugin:4:2)\",\"category\":\"JavaScript\",\"p"
        "arent\":2},\"4\":{\"name\":\"[Native] setCornerRadius\",\"category\":\"Native\","
        "\"parent\":\"3\"},\"5\":{\"name\":\"idle(plugin:9:1)\",\"category\":\"JavaScript"
        "\",\"parent\":\"1\"}},\"samples\":[{\"sf\":\"3\"},{\"sf\":\"3\"},{\"sf\":3},{\"s"
        "f\":\"4\"},{\"sf\":\"4\"},{\"sf\":\"4\"},{\"sf\":\"4\"},{\"sf\":\"5\"}]}";

    auto stack = loader::native::hottestStack(trace);
    assert(stack.size() == 2);
    assert(stack[0] == "spin(plugin:4:2)");
    assert(stack[1] == "start(plugin:1:10)");
    assert(loader::native::describeSampledStack(stack) ==
           "Its JavaScript was in spin(plugin:4:2), called from start(plugin:1:10).");
    assert(loader::native::describeSampledStack({}).empty());
    assert(loader::native::hottestStack("{broken").empty());
    return 0;
}
