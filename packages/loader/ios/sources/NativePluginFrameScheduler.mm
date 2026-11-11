#include "NativePluginFrameScheduler.h"

#import <QuartzCore/QuartzCore.h>
#include <functional>

#include "NativeFrameWorkQueue.h"

static loader::native::NativeFrameWorkQueue gFrameWork;

@interface IOSNativePluginFrameScheduler : NSObject

@property (nonatomic, strong) CADisplayLink *displayLink;

+ (instancetype)sharedScheduler;
- (void)start;
- (void)drain;

@end

@implementation IOSNativePluginFrameScheduler

+ (instancetype)sharedScheduler
{
    static IOSNativePluginFrameScheduler *scheduler;
    static dispatch_once_t                once;
    dispatch_once(&once, ^{ scheduler = [IOSNativePluginFrameScheduler new]; });
    return scheduler;
}

- (void)start
{
    if (self.displayLink)
    {
        return;
    }
    self.displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(drain)];
    [self.displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}

- (void)drain
{
    [self.displayLink invalidate];
    self.displayLink = nil;
    @autoreleasepool
    {
        gFrameWork.drain();
    }
}

@end

bool loader::ios::scheduleNativePluginFrameWork(std::function<void()> work)
{
    if (gFrameWork.enqueue(std::move(work)))
    {
        dispatch_async(dispatch_get_main_queue(),
                       ^{ [[IOSNativePluginFrameScheduler sharedScheduler] start]; });
    }
    return true;
}
