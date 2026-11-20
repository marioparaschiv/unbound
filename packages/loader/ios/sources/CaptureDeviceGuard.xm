#import <AVFoundation/AVFoundation.h>
#import <objc/runtime.h>

#import "SingleCopy.h"

static BOOL definesMethod(Class cls, SEL selector)
{
    unsigned int count = 0;
    Method *methods    = class_copyMethodList(cls, &count);
    BOOL found         = NO;
    for (unsigned int index = 0; index < count && !found; index++)
    {
        found = method_getName(methods[index]) == selector;
    }

    free(methods);
    return found;
}

static void guardNilString(Class cls, SEL selector)
{
    if (!cls || !definesMethod(cls, selector))
    {
        return;
    }

    Method method = class_getInstanceMethod(cls, selector);
    IMP original  = method_getImplementation(method);
    IMP guarded   = imp_implementationWithBlock(^NSString *(id device) {
        NSString *value = ((NSString * (*)(id, SEL)) original)(device, selector);
        return value ?: @"";
    });
    method_setImplementation(method, guarded);
}

%ctor
{
    if (UnboundIsDuplicateCopy())
    {
        return;
    }

    for (NSString *name in
         @[ @"AVCaptureDevice", @"AVCaptureFigVideoDevice", @"AVCaptureFigAudioDevice" ])
    {
        Class cls = NSClassFromString(name);
        for (NSString *selector in @[ @"localizedName", @"uniqueID", @"modelID", @"manufacturer" ])
        {
            guardNilString(cls, NSSelectorFromString(selector));
        }
    }
}
