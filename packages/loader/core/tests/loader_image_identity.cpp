#include <cassert>
#include <string>

#include "LoaderImageIdentity.h"

int main()
{
    loader::ImageIdentity identity = loader::loaderImageIdentity();
    assert(!identity.name.empty());
#if defined(__APPLE__)
    assert(identity.id.size() == 36 && identity.id[8] == '-');
#endif
    std::string line = loader::imageIdentityLine(identity);
    assert(identity.id.empty() ? line.empty()
                               : line == "Image " + identity.name + " " + identity.id + "\n");
    assert(loader::imageIdentityLine({"libunbound.so", ""}).empty());
    return 0;
}
