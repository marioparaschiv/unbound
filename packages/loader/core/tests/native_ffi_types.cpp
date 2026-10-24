#include <cassert>
#include <string>

#include "NativeFFITypes.h"

using loader::ffi::Kind;

int main()
{
    auto integer = loader::ffi::parseType("i32");
    assert(integer && integer->kind == Kind::Int32 && loader::ffi::typeSize(*integer) == 4);

    auto pointer = loader::ffi::parseType("pointer");
    assert(pointer && loader::ffi::typeSize(*pointer) == sizeof(void *));

    assert(!loader::ffi::parseType("object"));
    assert(!loader::ffi::parseType("struct:Unknown"));

    auto rect = loader::ffi::parseType("struct:CGRect");
    assert(rect && rect->layout);
    assert(rect->layout->size == 32 && rect->layout->alignment == 8);
    assert(rect->layout->fields.size() == 2);
    assert(rect->layout->fields[1].name == "size" && rect->layout->fields[1].offset == 16);
    assert(rect->layout->fields[1].type.layout->fields[1].name == "height");

    auto range = loader::ffi::parseType("struct:NSRange");
    assert(range && range->layout->size == 16 && range->layout->fields[1].offset == 8);

    assert(loader::ffi::structLayout("CGPoint") == loader::ffi::structLayout("CGPoint"));
    return 0;
}
