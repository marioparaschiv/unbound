package app.unbound.android

import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method
import java.lang.reflect.Modifier
import java.lang.reflect.Proxy

/**
 * Answers Discord's analytics requests locally with 204, a backstop to the client's tracking
 * builtin: every OkHttp client Discord builds gets an interceptor that short-circuits them.
 */
object Telemetry {
    private const val CLIENT_BUILDER = "okhttp3.OkHttpClient\$Builder"
    private const val INTERCEPTOR = "okhttp3.Interceptor"
    private const val CHAIN = "okhttp3.Interceptor\$Chain"
    private const val RESPONSE_BUILDER = "okhttp3.Response\$Builder"
    private const val RESPONSE_BODY = "okhttp3.ResponseBody"
    private const val MEDIA_TYPE = "okhttp3.MediaType"
    private const val PROTOCOL = "okhttp3.Protocol"
    private const val REQUEST = "okhttp3.Request"

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        val builder = classLoader.loadClass(CLIENT_BUILDER)
        val interceptorClass = classLoader.loadClass(INTERCEPTOR)
        val responses = Responses(classLoader)
        val interceptor = Proxy.newProxyInstance(classLoader, arrayOf(interceptorClass)) { proxy, method, args ->
            when (method.name) {
                // OkHttp handles the IOException a failed request throws; a reflective wrapper would crash it.
                "intercept" -> try {
                    responses.intercept(args!![0])
                } catch (error: InvocationTargetException) {
                    throw error.targetException
                }

                "equals" -> proxy === args?.getOrNull(0)

                "hashCode" -> System.identityHashCode(proxy)

                "toString" -> "UnboundTelemetryInterceptor"

                else -> null
            }
        }
        val addInterceptor = builder.getMethod("addInterceptor", interceptorClass)
        val interceptors = builder.getMethod("interceptors")

        xposed.hook(builder.getDeclaredMethod("build"))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                runCatching {
                    val added = interceptors.invoke(chain.thisObject) as? List<*>
                    if (added?.contains(interceptor) != true) addInterceptor.invoke(chain.thisObject, interceptor)
                }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to add the telemetry interceptor", it) }
                chain.proceed()
            }
        Logger.info(LogCategory.DEFAULT, "Blocking Discord's analytics requests.")
    }

    private class Responses(classLoader: ClassLoader) {
        private val chainClass = classLoader.loadClass(CHAIN)
        private val requestClass = classLoader.loadClass(REQUEST)
        private val request = chainClass.getMethod("request")
        private val proceed = chainClass.getMethod("proceed", requestClass)
        private val url = requestClass.getMethod("url")
        private val responseBuilder = classLoader.loadClass(RESPONSE_BUILDER)
        private val mediaType = classLoader.loadClass(MEDIA_TYPE)
        private val protocol = classLoader.loadClass(PROTOCOL)
        private val http11 = protocol.getMethod("valueOf", String::class.java).invoke(null, "HTTP_1_1")
        private val emptyBody: Method = classLoader.loadClass(RESPONSE_BODY).methods.first { method ->
            method.name == "create" && Modifier.isStatic(method.modifiers) &&
                method.parameterTypes.contentEquals(arrayOf(mediaType, String::class.java))
        }

        fun intercept(chain: Any): Any? {
            val original = request.invoke(chain)
            if (!NativeBridge.nativeIsBlockedTelemetry(url.invoke(original).toString())) {
                return proceed.invoke(chain, original)
            }
            val response = responseBuilder.getConstructor().newInstance()
            responseBuilder.getMethod("request", requestClass).invoke(response, original)
            responseBuilder.getMethod("protocol", protocol).invoke(response, http11)
            responseBuilder.getMethod("code", Int::class.javaPrimitiveType).invoke(response, 204)
            responseBuilder.getMethod("message", String::class.java).invoke(response, "No Content")
            responseBuilder.getMethod("body", emptyBody.returnType).invoke(response, emptyBody.invoke(null, null, ""))
            return responseBuilder.getMethod("build").invoke(response)
        }
    }
}
