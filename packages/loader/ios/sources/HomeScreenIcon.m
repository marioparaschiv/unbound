#import "HomeScreenIcon.h"

#import <UIKit/UIKit.h>
#import <errno.h>
#import <netinet/in.h>
#import <poll.h>
#import <stdint.h>
#import <stdio.h>
#import <string.h>
#import <sys/socket.h>
#import <sys/time.h>
#import <unistd.h>

static const char   *kProfileContentType       = "application/x-apple-aspen-config";
static const int     kMaxRequests              = 8;
static const int     kServeTimeoutMilliseconds = 120000;
static const CGFloat kWebClipIconSize          = 180;

static NSData *webClipIconData(NSString *imagePath)
{
    NSString *documents =
        NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
    NSString *iconRoot     = [[documents stringByAppendingPathComponent:@"Unbound/AppIcons"]
        stringByResolvingSymlinksInPath];
    NSString *resolvedPath = [imagePath stringByResolvingSymlinksInPath];
    if (![resolvedPath hasPrefix:[iconRoot stringByAppendingString:@"/"]])
    {
        return nil;
    }
    UIImage *source = [UIImage imageWithContentsOfFile:resolvedPath];
    if (!source || source.size.width <= 0 || source.size.height <= 0)
    {
        return nil;
    }
    CGSize  canvas = CGSizeMake(kWebClipIconSize, kWebClipIconSize);
    CGFloat scale  = MAX(canvas.width / source.size.width, canvas.height / source.size.height);
    CGSize  scaled = CGSizeMake(source.size.width * scale, source.size.height * scale);
    CGRect  destination =
        CGRectMake((canvas.width - scaled.width) / 2, (canvas.height - scaled.height) / 2,
                   scaled.width, scaled.height);
    UIGraphicsBeginImageContextWithOptions(canvas, NO, 1);
    [source drawInRect:destination];
    UIImage *icon = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    return icon ? UIImagePNGRepresentation(icon) : nil;
}

static NSData *buildWebClipProfile(NSString *name, NSData *png)
{
    NSString     *clipUUID    = NSUUID.UUID.UUIDString;
    NSString     *profileUUID = NSUUID.UUID.UUIDString;
    NSDictionary *clip        = @{
        @"PayloadType" : @"com.apple.webClip.managed",
        @"PayloadVersion" : @1,
        @"PayloadIdentifier" : [@"app.unbound.icon." stringByAppendingString:clipUUID],
        @"PayloadUUID" : clipUUID,
        @"PayloadDisplayName" : name,
        @"Label" : name,
        @"URL" : @"discord://",
        @"Icon" : png,
        @"IsRemovable" : @YES,
        @"FullScreen" : @YES,
        @"Precomposed" : @YES,
        @"IgnoreManifestScope" : @YES,
        @"TargetApplicationBundleIdentifier" : NSBundle.mainBundle.bundleIdentifier,
    };
    NSDictionary *profile = @{
        @"PayloadType" : @"Configuration",
        @"PayloadVersion" : @1,
        @"PayloadIdentifier" : [@"app.unbound.icon.profile." stringByAppendingString:profileUUID],
        @"PayloadUUID" : profileUUID,
        @"PayloadDisplayName" : [NSString stringWithFormat:@"%@ (Unbound icon)", name],
        @"PayloadDescription" : @"Adds a custom Home Screen icon that opens Discord.",
        @"PayloadRemovalDisallowed" : @NO,
        @"PayloadContent" : @[ clip ],
    };
    return [NSPropertyListSerialization dataWithPropertyList:profile
                                                      format:NSPropertyListXMLFormat_v1_0
                                                     options:0
                                                       error:nil];
}

static BOOL writeData(int descriptor, const void *bytes, size_t length)
{
    const uint8_t *data = bytes;
    size_t         sent = 0;

    while (sent < length)
    {
        ssize_t count = write(descriptor, data + sent, length - sent);
        if (count <= 0)
        {
            if (count < 0 && errno == EINTR)
            {
                continue;
            }
            return NO;
        }
        sent += (size_t) count;
    }

    return YES;
}

static void serveProfile(int listener, NSData *profile, NSString *requestPath,
                         void (^onFinish)(void))
{
    struct pollfd readiness = {.fd = listener, .events = POLLIN};
    for (int served = 0; served < kMaxRequests; served++)
    {
        int ready = poll(&readiness, 1, kServeTimeoutMilliseconds);
        if (ready < 0 && errno == EINTR)
        {
            continue;
        }
        if (ready <= 0 || !(readiness.revents & POLLIN))
        {
            break;
        }
        int client = accept(listener, NULL, NULL);
        if (client < 0)
        {
            continue;
        }

        int noSignal = 1;
        setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, &noSignal, sizeof(noSignal));
        struct timeval timeout = {.tv_sec = 3, .tv_usec = 0};
        setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
        char    request[2048] = {0};
        ssize_t requestLength = read(client, request, sizeof(request) - 1);
        char    method[8]     = {0};
        char    path[256]     = {0};
        BOOL validRequest = requestLength > 0 && sscanf(request, "%7s %255s", method, path) == 2 &&
                            strcmp(path, requestPath.UTF8String) == 0 &&
                            (strcmp(method, "GET") == 0 || strcmp(method, "HEAD") == 0);
        NSUInteger bodyLength = validRequest ? profile.length : 0;
        NSString  *headers    = [NSString
            stringWithFormat:@"HTTP/1.1 %@\r\nContent-Type: %@\r\n"
                             @"Content-Length: %lu\r\nConnection: close\r\n\r\n",
                             validRequest ? @"200 OK" : @"404 Not Found",
                             validRequest ? [NSString stringWithUTF8String:kProfileContentType]
                                          : @"text/plain",
                             (unsigned long) bodyLength];
        NSData    *headerData = [headers dataUsingEncoding:NSUTF8StringEncoding];
        BOOL       sent       = writeData(client, headerData.bytes, headerData.length);
        if (validRequest && strcmp(method, "GET") == 0)
        {
            sent = sent && writeData(client, profile.bytes, profile.length);
        }
        close(client);
    }
    onFinish();
    close(listener);
}

BOOL UBInstallHomeScreenIcon(NSString *name, NSString *imagePath)
{
    NSData *png = webClipIconData(imagePath);
    if (!png || !name.length || name.length > 32)
    {
        return NO;
    }
    NSData *profile = buildWebClipProfile(name, png);
    if (!profile)
    {
        return NO;
    }
    int listener = socket(AF_INET, SOCK_STREAM, 0);
    if (listener < 0)
    {
        return NO;
    }
    int reuse = 1;
    setsockopt(listener, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
    struct sockaddr_in address = {0};
    address.sin_family         = AF_INET;
    address.sin_port           = 0;
    address.sin_addr.s_addr    = htonl(INADDR_LOOPBACK);
    if (bind(listener, (struct sockaddr *) &address, sizeof(address)) != 0 ||
        listen(listener, 4) != 0)
    {
        close(listener);
        return NO;
    }
    socklen_t length = sizeof(address);
    if (getsockname(listener, (struct sockaddr *) &address, &length) != 0 || address.sin_port == 0)
    {
        close(listener);
        return NO;
    }
    uint16_t  port = ntohs(address.sin_port);
    NSString *requestPath =
        [NSString stringWithFormat:@"/unbound-icon-%@.mobileconfig", NSUUID.UUID.UUIDString];
    NSURL                             *url            = [NSURL
        URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%u%@", port, requestPath]];
    UIApplication                     *application    = UIApplication.sharedApplication;
    NSObject                          *stateLock      = [NSObject new];
    __block UIBackgroundTaskIdentifier backgroundTask = UIBackgroundTaskInvalid;
    __block BOOL                       didFinish      = NO;
    void (^finish)(void)                              = ^{
        UIBackgroundTaskIdentifier task = UIBackgroundTaskInvalid;
        @synchronized(stateLock)
        {
            if (didFinish)
            {
                return;
            }
            didFinish      = YES;
            task           = backgroundTask;
            backgroundTask = UIBackgroundTaskInvalid;
        }
        shutdown(listener, SHUT_RDWR);
        if (task != UIBackgroundTaskInvalid)
        {
            if ([NSThread isMainThread])
            {
                [application endBackgroundTask:task];
            }
            else
            {
                dispatch_async(dispatch_get_main_queue(),
                               ^{ [application endBackgroundTask:task]; });
            }
        }
    };
    void (^beginBackgroundTask)(void) = ^{
        backgroundTask = [application beginBackgroundTaskWithName:@"Unbound icon profile delivery"
                                                expirationHandler:finish];
    };
    if ([NSThread isMainThread])
    {
        beginBackgroundTask();
    }
    else
    {
        dispatch_sync(dispatch_get_main_queue(), beginBackgroundTask);
    }
    if (backgroundTask == UIBackgroundTaskInvalid)
    {
        close(listener);
        return NO;
    }
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0),
                   ^{ serveProfile(listener, profile, requestPath, finish); });
    dispatch_async(dispatch_get_main_queue(), ^{
        [application openURL:url options:@{} completionHandler:^(BOOL success) {}];
    });
    return YES;
}
