#import <UIKit/UIKit.h>

#include "AddonsCore.h"
#import "SingleCopy.h"

static const int kChargeRefreshLimitSeconds = 25;

static BOOL isCharging(UIDeviceBatteryState state)
{
    return state == UIDeviceBatteryStateCharging || state == UIDeviceBatteryStateFull;
}

static void refreshWhileAwake(void)
{
    UIApplication *application = UIApplication.sharedApplication;
    __block UIBackgroundTaskIdentifier task =
        [application beginBackgroundTaskWithName:@"Unbound charge refresh"
                               expirationHandler:^{
                                   [application endBackgroundTask:task];
                                   task = UIBackgroundTaskInvalid;
                               }];

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        if (UnboundLoader()->onCharging())
        {
            for (int waited = 0;
                 waited < kChargeRefreshLimitSeconds && UnboundLoader()->isWorkingInBackground();
                 waited++)
            {
                [NSThread sleepForTimeInterval:1.0];
            }
        }

        dispatch_async(dispatch_get_main_queue(), ^{
            if (task != UIBackgroundTaskInvalid)
            {
                [application endBackgroundTask:task];
                task = UIBackgroundTaskInvalid;
            }
        });
    });
}

%ctor
{
    if (UnboundIsDuplicateCopy())
    {
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        UIDevice *device                = UIDevice.currentDevice;
        device.batteryMonitoringEnabled = YES;
        __block BOOL charging           = isCharging(device.batteryState);

        [[NSNotificationCenter defaultCenter]
            addObserverForName:UIDeviceBatteryStateDidChangeNotification
                        object:nil
                         queue:NSOperationQueue.mainQueue
                    usingBlock:^(NSNotification *) {
                        BOOL now = isCharging(device.batteryState);
                        if (now && !charging)
                        {
                            refreshWhileAwake();
                        }

                        charging = now;
                    }];
    });
}
