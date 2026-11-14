#include <fstream>
#include <iostream>
#include <iterator>
#include <string>

#include "LoaderBundlePatch.h"

static std::string readFile(const char *path)
{
    std::ifstream file(path, std::ios::binary);
    return {std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
}

int main(int argc, char **argv)
{
    if (argc != 4)
    {
        std::cerr << "usage: bundle_patch_check <base bundle> <patch> <expected bundle>\n";
        return 2;
    }
    std::optional<std::string> patched = loader::applyBundlePatch(readFile(argv[1]), readFile(argv[2]));
    if (!patched)
    {
        std::cerr << argv[2] << " does not decode with " << argv[1] << " as its dictionary\n";
        return 1;
    }
    if (*patched != readFile(argv[3]))
    {
        std::cerr << argv[2] << " decodes, but not into " << argv[3] << "\n";
        return 1;
    }
    return 0;
}
