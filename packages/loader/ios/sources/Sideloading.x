#import "Sideloading.h"

static NSString *const BrowserLoginStateKey  = @"BrowserLoginState";
static NSString *const BrowserLoginSecretKey = @"BrowserLoginSecret";
static NSString *const BrowserLoginDateKey   = @"BrowserLoginDate";
static NSString *const SafariExtensionName = @"OpenInDiscord";

static NSString *browserLoginBase64URL(NSData *data)
{
    NSString *encoded = [data base64EncodedStringWithOptions:0];
    encoded = [encoded stringByReplacingOccurrencesOfString:@"+" withString:@"-"];
    encoded = [encoded stringByReplacingOccurrencesOfString:@"/" withString:@"_"];
    return [encoded stringByReplacingOccurrencesOfString:@"=" withString:@""];
}

static NSData *browserLoginDecodeBase64URL(NSString *encoded)
{
    if (encoded.length == 0)
    {
        return nil;
    }

    NSString *base64 = [encoded stringByReplacingOccurrencesOfString:@"-" withString:@"+"];
    base64 = [base64 stringByReplacingOccurrencesOfString:@"_" withString:@"/"];
    NSUInteger padding = (4 - base64.length % 4) % 4;
    base64 = [base64 stringByPaddingToLength:base64.length + padding
                                  withString:@"="
                             startingAtIndex:0];
    return [[NSData alloc] initWithBase64EncodedString:base64 options:0];
}

static NSData *browserLoginRandomData(NSUInteger length)
{
    NSMutableData *data = [NSMutableData dataWithLength:length];
    if (SecRandomCopyBytes(kSecRandomDefault, length, data.mutableBytes) != errSecSuccess)
    {
        return nil;
    }
    return data;
}

static BOOL browserLoginConstantTimeEqual(NSData *left, NSData *right)
{
    if (left.length != right.length)
    {
        return NO;
    }

    const uint8_t *leftBytes  = left.bytes;
    const uint8_t *rightBytes = right.bytes;
    uint8_t        difference = 0;
    for (NSUInteger index = 0; index < left.length; index++)
    {
        difference |= leftBytes[index] ^ rightBytes[index];
    }
    return difference == 0;
}

static NSString *browserLoginQueryValue(NSURLComponents *components, NSString *name)
{
    for (NSURLQueryItem *item in components.queryItems)
    {
        if ([item.name isEqualToString:name])
        {
            return item.value;
        }
    }
    return nil;
}

static void browserLoginClear(void)
{
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    [defaults removeObjectForKey:BrowserLoginStateKey];
    [defaults removeObjectForKey:BrowserLoginSecretKey];
    [defaults removeObjectForKey:BrowserLoginDateKey];
}

static NSString *safariExtensionIdentifier(void)
{
    NSString *extensionsPath = [[[NSBundle mainBundle] bundlePath]
        stringByAppendingPathComponent:@"PlugIns"];
    NSString *extensionPath = [extensionsPath
        stringByAppendingPathComponent:[SafariExtensionName stringByAppendingPathExtension:@"appex"]];
    NSBundle *extensionBundle = [NSBundle bundleWithPath:extensionPath];
    return [extensionBundle objectForInfoDictionaryKey:@"CFBundleIdentifier"];
}

static void browserLoginStartFlow(void)
{
    NSData *stateData = browserLoginRandomData(24);
    NSData *secret    = browserLoginRandomData(64);
    if (!stateData || !secret)
    {
        [Utilities alert:@"Discord could not create a secure browser login session."
                   title:@"Could Not Start Login"];
        return;
    }

    NSString       *state    = browserLoginBase64URL(stateData);
    NSString       *key      = browserLoginBase64URL(secret);
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    [defaults setObject:state forKey:BrowserLoginStateKey];
    [defaults setObject:secret forKey:BrowserLoginSecretKey];
    [defaults setObject:[NSDate date] forKey:BrowserLoginDateKey];

    NSString *urlString = [NSString stringWithFormat:
                               @"https://discord.com/login#login-state=%@&login-secret=%@",
                           state, key];
    [[UIApplication sharedApplication] openURL:[NSURL URLWithString:urlString]
                                        options:@{}
                              completionHandler:^(BOOL success) {
                                  if (!success)
                                  {
                                      browserLoginClear();
                                      [Utilities alert:@"Safari could not be opened."
                                                 title:@"Could Not Start Login"];
                                  }
    }];
}

static void browserLoginStart(void)
{
    if (![Utilities hasAppExtension:SafariExtensionName])
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"Safari extension is missing."];
        [Utilities alert:@"Browser login requires the Safari extension to be enabled."
                   title:@"Safari Extension Required"];
        return;
    }

    if (@available(iOS 26.2, *))
    {
        NSString *identifier = safariExtensionIdentifier();
        if (identifier.length == 0)
        {
            [Logger error:LOG_CATEGORY_DEFAULT
                   format:@"Safari extension bundle identifier is unavailable."];
            [Utilities alert:@"Discord could not identify the Safari extension."
                       title:@"Could Not Check Extension"];
            return;
        }

        [SFSafariExtensionManager
            getStateOfExtensionWithIdentifier:identifier
                             completionHandler:^(SFSafariExtensionState *state, NSError *error) {
                                 dispatch_async(dispatch_get_main_queue(), ^{
                                     if (error || !state)
                                     {
                                         [Logger error:LOG_CATEGORY_DEFAULT
                                                format:@"Could not read Safari extension state: %@.",
                                                        error];
                                         [Utilities alert:@"Discord could not check whether the Safari "
                                                          @"extension is enabled."
                                                    title:@"Could Not Check Extension"];
                                         return;
                                     }

                                     if (!state.isEnabled)
                                     {
                                         [Logger info:LOG_CATEGORY_DEFAULT
                                               format:@"Safari extension is disabled."];
                                         [Utilities alert:@"Enable the Safari extension "
                                                          @"in Settings, then try browser login again."
                                                    title:@"Safari Extension Disabled"];
                                         return;
                                     }

                                     browserLoginStartFlow();
                                 });
                             }];
        return;
    }

    browserLoginStartFlow();
}

static BOOL browserLoginHandleURL(NSURL *url)
{
    if (![[url.scheme lowercaseString] isEqualToString:@"com.hammerandchisel.discord"] ||
        ![[url.host lowercaseString] isEqualToString:@"login"])
    {
        return NO;
    }

    NSUserDefaults  *defaults = [NSUserDefaults standardUserDefaults];
    NSString        *state    = [defaults stringForKey:BrowserLoginStateKey];
    NSData           *secret   = [defaults dataForKey:BrowserLoginSecretKey];
    NSDate           *date     = [defaults objectForKey:BrowserLoginDateKey];
    if (state.length == 0 || secret.length == 0 || !date)
    {
        [Logger info:LOG_CATEGORY_DEFAULT
               format:@"Ignoring browser login callback without an active session."];
        return YES;
    }

    NSURLComponents *parts    = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
    NSString        *returnedState = browserLoginQueryValue(parts, @"state");
    NSData          *iv            = browserLoginDecodeBase64URL(browserLoginQueryValue(parts, @"iv"));
    NSData          *ciphertext =
        browserLoginDecodeBase64URL(browserLoginQueryValue(parts, @"ciphertext"));
    NSData *returnedMAC = browserLoginDecodeBase64URL(browserLoginQueryValue(parts, @"mac"));

    NSTimeInterval sessionAge = date ? -date.timeIntervalSinceNow : -1;
    BOOL           stateMatches = state.length > 0 && [state isEqualToString:returnedState];
    BOOL           sessionFresh = date && sessionAge >= 0 && sessionAge <= 600;
    if (!stateMatches)
    {
        [Logger info:LOG_CATEGORY_DEFAULT
               format:@"Ignoring callback with state length %lu; active state length %lu.",
                      (unsigned long)returnedState.length, (unsigned long)state.length];
        return YES;
    }

    BOOL validSession = state.length > 0 && secret.length == 64 && sessionFresh;
    if (!validSession || iv.length != kCCBlockSizeAES128 || ciphertext.length == 0 ||
        returnedMAC.length != CC_SHA256_DIGEST_LENGTH)
    {
        [Logger error:LOG_CATEGORY_DEFAULT
               format:@"Browser login validation failed: session=%d fresh=%d secret=%lu iv=%lu ciphertext=%lu mac=%lu age=%.1f.",
                      validSession, sessionFresh, (unsigned long)secret.length, (unsigned long)iv.length,
                      (unsigned long)ciphertext.length, (unsigned long)returnedMAC.length, sessionAge];
        browserLoginClear();
        [Utilities alert:@"The browser login session was invalid or expired. Please try again."
                   title:@"Could Not Finish Login"];
        return YES;
    }

    NSMutableData *authenticatedData = [NSMutableData data];
    [authenticatedData appendData:[state dataUsingEncoding:NSUTF8StringEncoding]];
    [authenticatedData appendData:iv];
    [authenticatedData appendData:ciphertext];

    uint8_t expectedMAC[CC_SHA256_DIGEST_LENGTH];
    CCHmac(kCCHmacAlgSHA256, (const uint8_t *)secret.bytes + 32, 32, authenticatedData.bytes,
           authenticatedData.length, expectedMAC);
    NSData *expectedMACData = [NSData dataWithBytes:expectedMAC length:sizeof(expectedMAC)];
    if (!browserLoginConstantTimeEqual(expectedMACData, returnedMAC))
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"Browser login MAC verification failed."];
        browserLoginClear();
        [Utilities alert:@"The browser login response could not be verified. Please try again."
                   title:@"Could Not Finish Login"];
        return YES;
    }

    NSMutableData *plaintext = [NSMutableData dataWithLength:ciphertext.length + kCCBlockSizeAES128];
    size_t         plaintextLength = 0;
    CCCryptorStatus status =
        CCCrypt(kCCDecrypt, kCCAlgorithmAES, kCCOptionPKCS7Padding, secret.bytes, 32, iv.bytes,
                ciphertext.bytes, ciphertext.length, plaintext.mutableBytes, plaintext.length,
                &plaintextLength);
    if (status != kCCSuccess)
    {
        [Logger error:LOG_CATEGORY_DEFAULT
               format:@"Browser login decryption failed with status %d.", status];
        browserLoginClear();
        [Utilities alert:@"The browser login response could not be read. Please try again."
                   title:@"Could Not Finish Login"];
        return YES;
    }

    plaintext.length = plaintextLength;
    NSString *token = [[NSString alloc] initWithData:plaintext encoding:NSUTF8StringEncoding];
    browserLoginClear();
    if (token.length < 20)
    {
        [Logger error:LOG_CATEGORY_DEFAULT
               format:@"Browser login returned a short token (%lu characters).",
                      (unsigned long)token.length];
        [Utilities alert:@"Safari did not return a valid Discord session. Please try again."
                   title:@"Could Not Finish Login"];
        return YES;
    }

    [Logger info:LOG_CATEGORY_DEFAULT format:@"Browser login callback verified."];
    CompleteBrowserLogin(token);
    return YES;
}

static BOOL browserLoginShouldHandleController(ASAuthorizationController *controller)
{
    for (ASAuthorizationRequest *request in controller.authorizationRequests)
    {
        if ([request conformsToProtocol:@protocol(ASAuthorizationPublicKeyCredentialAssertionRequest)])
        {
            return YES;
        }
    }
    return NO;
}

static NSError *iconError(NSInteger code, NSString *description)
{
    return [NSError errorWithDomain:@"Icon"
                               code:code
                           userInfo:@{ NSLocalizedDescriptionKey : description }];
}

static void completeIconChange(void (^completion)(NSError *error), NSError *error)
{
    if (completion)
    {
        dispatch_async(dispatch_get_main_queue(), ^{ completion(error); });
    }
}

static void setAlternateIconNameWithUIKit(NSString *iconName,
                                           void (^completion)(NSError *error),
                                           NSError *fallbackError)
{
    UIApplication *application = UIApplication.sharedApplication;
    SEL setterSelector         = NSSelectorFromString(@"_setAlternateIconName:completionHandler:");
    if (![application respondsToSelector:setterSelector])
    {
        completeIconChange(completion, fallbackError);
        return;
    }

    typedef void (*IconSetter)(id, SEL, NSString *, void (^)(NSError *error));
    IconSetter setIcon = (IconSetter) objc_msgSend;
    setIcon(application, setterSelector, iconName, ^(NSError *error) {
        [Logger info:LOG_CATEGORY_DEFAULT
               format:@"UIKit private icon result: icon=%@ error=%@.",
                       iconName ?: @"<primary>", error];
        completeIconChange(completion, error ?: fallbackError);
    });
}

void SetAlternateIconName(NSString *iconName, void (^completion)(NSError *error))
{
    Class bundleProxyClass = NSClassFromString(@"LSBundleProxy");
    SEL proxySelector = NSSelectorFromString(@"bundleProxyForCurrentProcess");
    if (!bundleProxyClass || ![bundleProxyClass respondsToSelector:proxySelector])
    {
        NSError *error = iconError(1, @"LSBundleProxy is unavailable");
        [Logger error:LOG_CATEGORY_DEFAULT format:@"LSBundleProxy unavailable."];
        setAlternateIconNameWithUIKit(iconName, completion, error);
        return;
    }

    id (*getBundleProxy)(id, SEL) = (id (*)(id, SEL))objc_msgSend;
    id bundleProxy = getBundleProxy(bundleProxyClass, proxySelector);
    SEL setterSelector = NSSelectorFromString(@"setAlternateIconName:withResult:");
    if (!bundleProxy || ![bundleProxy respondsToSelector:setterSelector])
    {
        NSError *error = iconError(2, @"LSApplicationProxy icon setter is unavailable");
        [Logger error:LOG_CATEGORY_DEFAULT format:@"LSApplicationProxy icon setter unavailable."];
        setAlternateIconNameWithUIKit(iconName, completion, error);
        return;
    }

    typedef void (*IconSetter)(id, SEL, NSString *, void (^)(BOOL success, NSError *error));
    IconSetter setIcon = (IconSetter)objc_msgSend;
    setIcon(bundleProxy, setterSelector, iconName, ^(BOOL success, NSError *error) {
        [Logger info:LOG_CATEGORY_DEFAULT
               format:@"LSApplicationProxy icon result: success=%d icon=%@ error=%@.",
                       success, iconName ?: @"<primary>", error];
        if (success && !error)
        {
            completeIconChange(completion, nil);
            return;
        }

        NSError *fallbackError = error ?: iconError(3, @"LSApplicationProxy rejected the icon change");
        setAlternateIconNameWithUIKit(iconName, completion, fallbackError);
    });
}

%hook NSFileManager
- (NSURL *)containerURLForSecurityApplicationGroupIdentifier:(NSString *)identifier
{
    if (identifier != nil)
    {
        NSError *error;

        NSFileManager *manager = [NSFileManager defaultManager];
        NSURL         *url     = [manager URLForDirectory:NSDocumentDirectory
                                     inDomain:NSUserDomainMask
                            appropriateForURL:nil
                                       create:YES
                                        error:&error];

        if (error)
        {
            [Logger error:LOG_CATEGORY_DEFAULT
                   format:@"Failed getting documents directory: %@", error];
            return %orig(identifier);
        }

        return url;
    }

    return %orig(identifier);
}
%end

%hook UIDocumentPickerViewController

- (instancetype)initForOpeningContentTypes:(NSArray<UTType *> *)contentTypes asCopy:(BOOL)asCopy
{
    BOOL shouldMultiselect = NO;
    if ([contentTypes count] == 1 && contentTypes[0] == UTTypeFolder)
    {
        shouldMultiselect = YES;
    }

    NSArray<UTType *> *contentTypesNew = @[ UTTypeItem, UTTypeFolder ];

    UIDocumentPickerViewController *ans = %orig(contentTypesNew, YES);
    if (shouldMultiselect)
    {
        [ans setAllowsMultipleSelection:YES];
    }
    return ans;
}

- (instancetype)initWithDocumentTypes:(NSArray<UTType *> *)contentTypes inMode:(NSUInteger)mode
{
    return [self initForOpeningContentTypes:contentTypes asCopy:(mode == 1 ? NO : YES)];
}

- (void)setAllowsMultipleSelection:(BOOL)allowsMultipleSelection
{
    if ([self allowsMultipleSelection])
    {
        return;
    }
    %orig(YES);
}

%end

%hook UIDocumentBrowserViewController

- (instancetype)initForOpeningContentTypes:(NSArray<UTType *> *)contentTypes
{
    NSArray<UTType *> *contentTypesNew = @[ UTTypeItem, UTTypeFolder ];
    return %orig(contentTypesNew);
}

%end

%hook NSURL

- (BOOL)startAccessingSecurityScopedResource
{
    %orig;
    return YES;
}

%end

%hook UIApplication
- (void)setAlternateIconName:(NSString *)iconName completionHandler:(void (^)(NSError *))completion
{
    void (^wrappedCompletion)(NSError *) = ^(NSError *error) {
        if (completion)
        {
            completion(error);
        }
    };

    SetAlternateIconName(iconName, wrappedCompletion);
}
%end

%hook ASAuthorizationController

- (void)performRequests
{
    if (browserLoginShouldHandleController(self))
    {
        browserLoginStart();
        return;
    }
    %orig;
}

- (void)performRequestsWithOptions:(NSUInteger)options
{
    if (browserLoginShouldHandleController(self))
    {
        browserLoginStart();
        return;
    }
    %orig(options);
}

%end

%hook RCTLinkingManager

+ (BOOL)application:(UIApplication *)application
             openURL:(NSURL *)url
             options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options
{
    if (browserLoginHandleURL(url))
    {
        return YES;
    }
    return %orig(application, url, options);
}

%end

%ctor
{
    if (![Utilities hasDiscordProductionEntitlements])
    {
        %init();
    }
}
