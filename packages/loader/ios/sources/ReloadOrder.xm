#import <objc/runtime.h>

#import "Logger.h"
#import "RCTHost.h"
#import "SingleCopy.h"

// A reload notifies its listeners in hash-table order. When RCTHost goes first, the old JS thread
// waits on main to invalidate TurboModules while main waits on libdiscore's JS-thread teardown, so
// both stall until libdiscore's 2 s timeout. Tearing libdiscore down first avoids it.

@interface LibDiscoreModule : NSObject
- (void)didReceiveReloadCommand;
@end

static __weak LibDiscoreModule *gLibDiscore = nil;
static char tornDownKey;

%group ReloadOrder

%hook LibDiscoreModule

- (id)init
{
    id instance = %orig;
    gLibDiscore = instance;
    return instance;
}

- (void)didReceiveReloadCommand
{
    // Runs once per module: RCTHost's hook calls it early, then the reload's listener pass does.
    if (objc_getAssociatedObject(self, &tornDownKey))
    {
        return;
    }

    objc_setAssociatedObject(self, &tornDownKey, @YES, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    %orig;
}

%end

%hook RCTHost

- (void)didReceiveReloadCommand
{
    LibDiscoreModule *libDiscore = gLibDiscore;
    if (libDiscore)
    {
        [Logger info:LOG_CATEGORY_DEFAULT format:@"Tearing down libdiscore before RCTHost."];
        [libDiscore didReceiveReloadCommand];
    }

    %orig;
}

%end

%end

%ctor
{
    if (UnboundIsDuplicateCopy())
    {
        return;
    }

    Class libDiscore = objc_getClass("LibDiscoreModule");
    if (libDiscore && class_getInstanceMethod(libDiscore, @selector(didReceiveReloadCommand))
        && class_getInstanceMethod(objc_getClass("RCTHost"), @selector(didReceiveReloadCommand)))
    {
        %init(ReloadOrder);
    }
}
