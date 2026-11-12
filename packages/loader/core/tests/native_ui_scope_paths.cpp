#include <cassert>
#include <string>
#include <vector>

#include "NativeUIScope.h"

using loader::native::uiScopePaths;

int main()
{
    const std::vector<std::string> paths = {"objc.invoke", "objc.hook", "java.invoke", "objc",
                                            "fabric.mount"};
    assert((uiScopePaths(paths, "objc.") == std::vector<std::string>{"invoke", "hook"}));
    assert(uiScopePaths(paths, "") == paths);
    assert(uiScopePaths({}, "objc.").empty());
    assert((uiScopePaths({"objc.", "objc.objc.call"}, "objc.") ==
            std::vector<std::string>{"", "objc.call"}));
}
