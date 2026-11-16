#import "NativeObjectLifetime.h"

#import <objc/message.h>
#import <objc/runtime.h>

namespace loader::ios {
bool isDeallocating(__unsafe_unretained id object)
{
    static SEL selector = sel_registerName("_isDeallocating");
    if (!object || object_isClass(object))
    {
        return false;
    }

    if (!class_respondsToSelector(object_getClass(object), selector))
    {
        return false;
    }

    return ((BOOL (*)(id, SEL)) objc_msgSend)(object, selector);
}
}
