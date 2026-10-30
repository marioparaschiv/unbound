package app.astral.android

import android.content.Context
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode

object Analytics {
    private const val SENTRY_INIT_PROVIDER = "io.sentry.android.core.SentryInitProvider"
    private const val SENTRY_MODULE = "io.sentry.react.RNSentryModuleImpl"
    private const val REACT_MAP = "com.facebook.react.bridge.ReadableMap"
    private const val REACT_PROMISE = "com.facebook.react.bridge.Promise"
    private const val APPSFLYER = "com.appsflyer.AppsFlyerLib"
    private const val APPSFLYER_LISTENER = "com.appsflyer.attribution.AppsFlyerRequestListener"
    private const val APPSFLYER_CONVERSION_LISTENER = "com.appsflyer.AppsFlyerConversionListener"

    fun block(xposed: XposedInterface, classLoader: ClassLoader) {
        runCatching { blockInitProvider(xposed, classLoader) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to block the Sentry init provider", it) }
        runCatching { blockNativeSdk(xposed, classLoader) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to block the Sentry native SDK", it) }
        runCatching { blockAppsFlyer(xposed, classLoader) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to block AppsFlyer", it) }
    }

    private fun blockAppsFlyer(xposed: XposedInterface, classLoader: ClassLoader) {
        val api = classLoader.loadClass(APPSFLYER)
        val implementation = api.getMethod("getInstance").invoke(null)?.javaClass ?: api
        val context = Context::class.java
        val starts = listOf(
            implementation.getMethod("start", context),
            implementation.getMethod("start", context, String::class.java),
            implementation.getMethod("start", context, String::class.java, classLoader.loadClass(APPSFLYER_LISTENER)),
        )
        val init = implementation.getMethod(
            "init",
            String::class.java,
            classLoader.loadClass(APPSFLYER_CONVERSION_LISTENER),
            context,
        )

        for (start in starts) {
            xposed.hook(start)
                .setExceptionMode(ExceptionMode.PROTECTIVE)
                .intercept {
                    Logger.info(LogCategory.DEFAULT, "Blocked AppsFlyer.")
                    null
                }
        }
        xposed.hook(init)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain -> chain.thisObject }
        xposed.hook(implementation.getMethod("isStopped"))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { true }
    }

    private fun blockInitProvider(xposed: XposedInterface, classLoader: ClassLoader) {
        val provider = classLoader.loadClass(SENTRY_INIT_PROVIDER)
        xposed.hook(provider.getDeclaredMethod("onCreate"))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept {
                Logger.info(LogCategory.DEFAULT, "Blocked Sentry auto-initialization.")
                true
            }
    }

    private fun blockNativeSdk(xposed: XposedInterface, classLoader: ClassLoader) {
        val module = classLoader.loadClass(SENTRY_MODULE)
        val promiseClass = classLoader.loadClass(REACT_PROMISE)
        val initNativeSdk = module.getDeclaredMethod(
            "initNativeSdk",
            classLoader.loadClass(REACT_MAP),
            promiseClass,
        )
        val resolve = promiseClass.getMethod("resolve", Any::class.java)

        xposed.hook(initNativeSdk)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                Logger.info(LogCategory.DEFAULT, "Blocked Sentry native SDK.")
                resolve.invoke(chain.getArg(1), java.lang.Boolean.FALSE)
                null
            }
    }
}
