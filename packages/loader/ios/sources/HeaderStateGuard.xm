#import "HeaderStateGuard.h"

#import <objc/runtime.h>

#import "SingleCopy.h"

// react-native-screens enumerates the header config's live subview array, while each subview's
// synchronous state update can mount a pending commit that adds or removes a header subview
// (software-mansion/react-native-screens#4811).
static NSString *const kHeaderConfigClass = @"RNSScreenStackHeaderConfig";
static NSString *const kMutatedReason     = @"was mutated while being enumerated";

static BOOL isMutatedDuringEnumeration(NSException *exception)
{
    return [exception.name isEqualToString:NSGenericException] &&
           [exception.reason rangeOfString:kMutatedReason].location != NSNotFound;
}

%group HeaderStateGuard

%hook RNSScreenStackHeaderConfig

- (void)updateHeaderStateInShadowTreeInContextOfNavigationBar:(UINavigationBar *)navigationBar
{
    @try
    {
        %orig;
    }

    @catch (NSException *exception)
    {
        if (!isMutatedDuringEnumeration(exception))
        {
            @throw;
        }

        [Logger error:LOG_CATEGORY_HOOKS
               format:@"Failed to update the header state of %@ %p: its subviews changed "
                      @"mid-update (%@); updating it again instead of crashing.",
                      kHeaderConfigClass, self, exception.reason];

        // The mount that changed the subviews has finished, so this pass sees a stable array.
        %orig;
    }
}

%end

%end

%ctor
{
    if (UnboundIsDuplicateCopy())
    {
        return;
    }

    // Builds that drop or rename the method keep react-native-screens' own behaviour.
    Class headerConfig = NSClassFromString(kHeaderConfigClass);
    if (!class_getInstanceMethod(headerConfig,
                                 @selector(updateHeaderStateInShadowTreeInContextOfNavigationBar:)))
    {
        return;
    }

    %init(HeaderStateGuard);
}
