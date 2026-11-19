#import "ListUpdateGuard.h"

#include "LoaderAddonActivity.h"
#import "SingleCopy.h"

static NSArray<NSString *> *const kRejectedUpdateReasons =
    @[ @"Invalid batch updates", @"Invalid update", @"invalid number of", @"attempt to" ];

static BOOL isRejectedListUpdate(NSException *exception)
{
    if (![exception.name isEqualToString:NSInternalInconsistencyException])
    {
        return NO;
    }

    for (NSString *reason in kRejectedUpdateReasons)
    {
        if ([exception.reason rangeOfString:reason options:NSCaseInsensitiveSearch].location
            != NSNotFound)
        {
            return YES;
        }
    }

    return NO;
}

static NSString *recentHookAddonName(void)
{
    loader::HookCall calls[loader::kHookTrailLength];
    size_t count = loader::crashingThreadHookCalls(calls, loader::kHookTrailLength);
    for (size_t index = 0; index < count; index++)
    {
        std::string record = loader::addonRecord(calls[index].addon);
        if (record.empty())
        {
            continue;
        }

        NSData *json         = [NSData dataWithBytes:record.data() length:record.size()];
        NSDictionary *parsed = [NSJSONSerialization JSONObjectWithData:json options:0 error:nil];
        NSString *name       = [parsed isKindOfClass:[NSDictionary class]] ? parsed[@"name"] : nil;
        if ([name isKindOfClass:[NSString class]])
        {
            return name;
        }
    }

    return nil;
}

static BOOL recoverListUpdate(id list, NSException *exception)
{
    if (!isRejectedListUpdate(exception))
    {
        return NO;
    }

    NSString *addon = recentHookAddonName();
    [Logger
         error:LOG_CATEGORY_HOOKS
        format:@"Failed to apply a list update to %@: UIKit rejected it (%@)%@; reloaded the list "
               @"instead of crashing.",
               NSStringFromClass([list class]), exception.reason,
               addon ? [NSString stringWithFormat:@" (the last plugin hook here was %@'s)", addon]
                     : @""];
    [list reloadData];
    return YES;
}

% hook UITableView

    - (void) endUpdates
{
    @try
    {
        % orig;
    }

    @catch (NSException *exception)
    {
        if (!recoverListUpdate(self, exception))
        {
            @throw;
        }
    }
}

- (void)performBatchUpdates:(void (^)(void))updates completion:(void (^)(BOOL))completion
{
    @try
    {
        % orig;
    }

    @catch (NSException *exception)
    {
        if (!recoverListUpdate(self, exception))
        {
            @throw;
        }
    }
}

% end

        % hook UICollectionView

    - (void) performBatchUpdates : (void (^)(void)) updates completion : (void (^)(BOOL)) completion
{
    @try
    {
        % orig;
    }

    @catch (NSException *exception)
    {
        if (!recoverListUpdate(self, exception))
        {
            @throw;
        }
    }
}

% end

    % ctor
{
    if (UnboundIsDuplicateCopy())
    {
        return;
    }

    % init;
}
