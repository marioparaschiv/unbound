#include <cassert>
#include <cstdlib>
#include <string>
#include <unistd.h>

#include "LoaderBundleSignature.h"
#include "LoaderDigestCache.h"
#include "LoaderFiles.h"

int main()
{
    char        pattern[] = "/tmp/astral-digest-XXXXXX";
    std::string directory = mkdtemp(pattern);
    std::string bundle    = loader::joinPath(directory, "index.js");

    assert(loader::writeTextFileAtomically(bundle, "first"));
    assert(loader::cachedSha512(directory, bundle, "first") == loader::sha512Hex("first"));
    assert(loader::fileExists(loader::joinPath(directory, ".verified.json")));
    assert(loader::cachedSha512(directory, bundle, "first") == loader::sha512Hex("first"));

    usleep(20000);
    assert(loader::writeTextFileAtomically(bundle, "second"));
    assert(loader::cachedSha512(directory, bundle, "second") == loader::sha512Hex("second"));

    assert(loader::cachedSha512(directory, bundle, "other contents of another size") ==
           loader::sha512Hex("other contents of another size"));

    loader::removeTree(directory, "");
    return 0;
}
