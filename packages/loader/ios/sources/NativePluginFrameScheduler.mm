#include "NativePluginFrameScheduler.h"

#import <QuartzCore/QuartzCore.h>
#include <deque>
#include <exception>
#include <functional>
#include <mutex>
#include <string>
#include <vector>

#include "LoaderLog.h"

static std::mutex                        gFrameWorkMutex;
static std::deque<std::function<void()>> gFrameWork;
static bool                              gFrameScheduled = false;

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

    std::deque<std::function<void()>> work;
    {
        std::lock_guard<std::mutex> lock(gFrameWorkMutex);
        work.swap(gFrameWork);
        gFrameScheduled = false;
    }

    @autoreleasepool
    {
        for (auto &item : work)
        {
            try
            {
                item();
            }
            catch (const std::exception &error)
            {
                loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS,
                            std::string("Frame-batched native work failed: ") + error.what());
            }
            catch (...)
            {
                loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS,
                            "Frame-batched native work failed.");
            }
        }
    }
}

@end

void loader::ios::scheduleNativePluginFrameWork(std::function<void()> work)
{
    bool schedule = false;
    {
        std::lock_guard<std::mutex> lock(gFrameWorkMutex);
        gFrameWork.push_back(std::move(work));
        if (!gFrameScheduled)
        {
            gFrameScheduled = true;
            schedule        = true;
        }
    }
    if (schedule)
    {
        dispatch_async(dispatch_get_main_queue(),
                       ^{ [[IOSNativePluginFrameScheduler sharedScheduler] start]; });
    }
}
