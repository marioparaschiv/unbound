#include <cassert>
#include <cmath>
#include <stdexcept>
#include <string>

#include "NativeBatchReferences.h"

using loader::native::batchReferenceIndex;
using loader::native::batchResultIndex;

static std::string rejection(const nlohmann::json &value, size_t stepIndex)
{
    try
    {
        batchResultIndex(value, stepIndex);
    }
    catch (const std::invalid_argument &error)
    {
        return error.what();
    }
    return "";
}

int main()
{
    assert(!batchResultIndex(nlohmann::json(nullptr), 3));
    assert(!batchResultIndex(nlohmann::json(2), 3));
    assert(!batchResultIndex(nlohmann::json::object(), 3));
    assert(!batchResultIndex({{"id", "objc-1"}}, 3));

    assert(*batchResultIndex({{"$nativeBatchResult", 0}}, 1) == 0);
    assert(*batchResultIndex({{"$nativeBatchResult", 2}}, 3) == 2);
    assert(*batchResultIndex({{"$nativeBatchResult", 2.0}}, 3) == 2);

    assert(rejection({{"$nativeBatchResult", "0"}}, 3) ==
           "Native batch result index must be an integer");
    assert(rejection({{"$nativeBatchResult", nullptr}}, 3) ==
           "Native batch result index must be an integer");
    assert(rejection({{"$nativeBatchResult", 3}}, 3) ==
           "Native batch can only reference earlier results");
    assert(rejection({{"$nativeBatchResult", 0}}, 0) ==
           "Native batch can only reference earlier results");
    assert(rejection({{"$nativeBatchResult", -1}}, 3) ==
           "Native batch can only reference earlier results");
    assert(rejection({{"$nativeBatchResult", 1.5}}, 3) ==
           "Native batch can only reference earlier results");

    bool rejectedNaN = false;
    try
    {
        batchReferenceIndex(std::nan(""), 3);
    }
    catch (const std::invalid_argument &)
    {
        rejectedNaN = true;
    }
    assert(rejectedNaN);
}
