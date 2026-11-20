#import <BackgroundTasks/BackgroundTasks.h>
#import <UIKit/UIKit.h>

#include "AddonsCore.h"
#import "Logger.h"
#import "SingleCopy.h"

static NSString *const kRefreshTask          = @"app.unbound.bundle-refresh";
static const NSTimeInterval kRefreshInterval = 6 * 60 * 60;
static const int kRefreshCheckLimitSeconds   = 25;

static BOOL declaresRefreshTask(void)
{
    NSArray *declared = NSBundle.mainBundle.infoDictionary[@"BGTaskSchedulerPermittedIdentifiers"];
    return [declared isKindOfClass:[NSArray class]] && [declared containsObject:kRefreshTask];
}

static void scheduleRefresh(void)
{
    BGAppRefreshTaskRequest *request =
        [[BGAppRefreshTaskRequest alloc] initWithIdentifier:kRefreshTask];
    request.earliestBeginDate = [NSDate dateWithTimeIntervalSinceNow:kRefreshInterval];

    NSError *error = nil;
    if (![BGTaskScheduler.sharedScheduler submitTaskRequest:request error:&error])
    {
        [Logger info:LOG_CATEGORY_UPDATER
              format:@"Failed to schedule the background bundle refresh: %@",
                     error.localizedDescription];
    }
}

static void runRefresh(BGTask *task)
{
    scheduleRefresh();

    __block BOOL finished       = NO;
    __weak BGTask *expiringTask = task;
    task.expirationHandler      = ^{
        if (!finished)
        {
            finished = YES;
            [expiringTask setTaskCompletedWithSuccess:NO];
        }
    };

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        if (UnboundLoader()->onBackground())
        {
            for (int waited = 0;
                 waited < kRefreshCheckLimitSeconds && UnboundLoader()->isCheckingForUpdate();
                 waited++)
            {
                [NSThread sleepForTimeInterval:1.0];
            }
        }

        dispatch_async(dispatch_get_main_queue(), ^{
            if (!finished)
            {
                finished = YES;
                [Logger info:LOG_CATEGORY_UPDATER
                      format:@"Checked for a new bundle in the background."];
                [task setTaskCompletedWithSuccess:YES];
            }
        });
    });
}

%ctor
{
    if (UnboundIsDuplicateCopy() || !declaresRefreshTask())
    {
        return;
    }

    BOOL registered = [BGTaskScheduler.sharedScheduler
        registerForTaskWithIdentifier:kRefreshTask
                           usingQueue:nil
                        launchHandler:^(BGTask *task) { runRefresh(task); }];
    if (!registered)
    {
        [Logger info:LOG_CATEGORY_UPDATER
              format:@"Failed to register the background bundle refresh."];
        return;
    }

    [[NSNotificationCenter defaultCenter]
        addObserverForName:UIApplicationDidEnterBackgroundNotification
                    object:nil
                     queue:nil
                usingBlock:^(NSNotification *) { scheduleRefresh(); }];
}
