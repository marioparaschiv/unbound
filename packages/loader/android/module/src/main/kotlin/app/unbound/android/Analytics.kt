package app.unbound.android

import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode

object Analytics {
    private const val SENTRY_INIT_PROVIDER = "io.sentry.android.core.SentryInitProvider"
    private const val SENTRY_MODULE = "io.sentry.react.RNSentryModuleImpl"
    private const val REACT_MAP = "com.facebook.react.bridge.ReadableMap"
    private const val REACT_PROMISE = "com.facebook.react.bridge.Promise"

    fun block(xposed: XposedInterface, classLoader: ClassLoader) {
        runCatching { blockInitProvider(xposed, classLoader) }
            .onFailure { Logger.error("default", "Failed to block the Sentry init provider", it) }
        runCatching { blockNativeSdk(xposed, classLoader) }
            .onFailure { Logger.error("default", "Failed to block the Sentry native SDK", it) }
    }

    private fun blockInitProvider(xposed: XposedInterface, classLoader: ClassLoader) {
        val provider = classLoader.loadClass(SENTRY_INIT_PROVIDER)
        xposed.hook(provider.getDeclaredMethod("onCreate"))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept {
                Logger.info("default", "Blocked Sentry auto-initialization.")
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
                Logger.info("default", "Blocked Sentry native SDK.")
                resolve.invoke(chain.getArg(1), java.lang.Boolean.FALSE)
                null
            }
    }
}
