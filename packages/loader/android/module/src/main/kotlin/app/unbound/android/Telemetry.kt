package app.unbound.android

import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import java.io.Closeable
import java.io.File
import java.lang.reflect.Constructor
import java.lang.reflect.Field
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method
import java.lang.reflect.Modifier
import java.lang.reflect.Proxy
import java.net.URI
import java.nio.channels.ByteChannel
import java.nio.channels.ReadableByteChannel

/**
 * Answers Discord's analytics requests locally with 204, a backstop to the client's tracking
 * builtin: an interceptor on every OkHttp client, or, where R8 renamed OkHttp, a hook on its calls.
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
    private const val NETWORKING_MODULE = "com.facebook.react.modules.network.NetworkingModule"
    private const val NETWORKING_CLIENT = "client"
    private const val EMPTY_BODY_CACHE = "telemetryEmptyBody"
    private const val CALL_CACHE = "telemetryCall"
    private const val NO_CONTENT = 204

    internal fun install(xposed: XposedInterface, classLoader: ClassLoader, cache: StartupCache, apk: File) {
        if (runCatching { classLoader.loadClass(CLIENT_BUILDER) }.isSuccess) {
            installInterceptor(xposed, classLoader)
            Logger.info(LogCategory.DEFAULT, "Blocking Discord's analytics requests.")
            return
        }
        val calls = ShrunkCalls.resolve(classLoader, cache, apk)
        if (calls == null) {
            Logger.warning(
                LogCategory.DEFAULT,
                "Discord's networking classes were not recognised, so its analytics requests are left to the client.",
            )
            return
        }
        calls.install(xposed, EmptyBody(classLoader, calls.responses.body, cache, apk))
        Logger.info(LogCategory.DEFAULT, "Blocking Discord's analytics requests.")
    }

    private fun logBlocked(url: String) {
        Logger.debug(LogCategory.DEFAULT, "Blocked ${runCatching { URI(url).path }.getOrNull() ?: url}.")
    }

    private fun installInterceptor(xposed: XposedInterface, classLoader: ClassLoader) {
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
            val address = url.invoke(original).toString()
            if (!NativeBridge.nativeIsBlockedTelemetry(address)) {
                return proceed.invoke(chain, original)
            }
            logBlocked(address)
            val response = responseBuilder.getConstructor().newInstance()
            responseBuilder.getMethod("request", requestClass).invoke(response, original)
            responseBuilder.getMethod("protocol", protocol).invoke(response, http11)
            responseBuilder.getMethod("code", Int::class.javaPrimitiveType).invoke(response, NO_CONTENT)
            responseBuilder.getMethod("message", String::class.java).invoke(response, "No Content")
            responseBuilder.getMethod("body", emptyBody.returnType).invoke(response, emptyBody.invoke(null, null, ""))
            return responseBuilder.getMethod("build").invoke(response)
        }
    }

    private fun isInstanceMember(modifiers: Int) = !Modifier.isStatic(modifiers)

    private fun instanceFields(type: Class<*>) = type.declaredFields.filter { isInstanceMember(it.modifiers) }

    private fun instanceMethods(type: Class<*>) = type.declaredMethods.filter { isInstanceMember(it.modifiers) }

    private class ShrunkCalls(private val call: Class<*>, private val request: Field, val responses: ShrunkResponses) {
        @Volatile private var url: Field? = null

        fun install(xposed: XposedInterface, body: EmptyBody) {
            for (method in instanceMethods(call)) {
                if (method.parameterCount != 0 || method.returnType != responses.response) continue
                xposed.hook(method)
                    .setExceptionMode(ExceptionMode.PROTECTIVE)
                    .intercept { chain ->
                        val original = request.get(chain.thisObject)
                        val address = original?.let(::urlOf)
                        if (address == null || !NativeBridge.nativeIsBlockedTelemetry(address)) {
                            return@intercept chain.proceed()
                        }
                        val response = responses.noContent(original, body.value) ?: return@intercept chain.proceed()
                        logBlocked(address)
                        response
                    }
            }
        }

        private fun urlOf(original: Any): String? {
            url?.let { return it.get(original)?.toString() }
            val field = instanceFields(original.javaClass).firstOrNull { field ->
                if (field.type.isPrimitive || field.type == String::class.java) return@firstOrNull false
                field.isAccessible = true
                field.get(original)?.toString()?.let { it.startsWith("https://") || it.startsWith("http://") } == true
            } ?: return null
            url = field
            return field.get(original)?.toString()
        }

        companion object {
            fun resolve(classLoader: ClassLoader, cache: StartupCache, apk: File): ShrunkCalls? = runCatching {
                val module = classLoader.loadClass(NETWORKING_MODULE)
                val client = module.getDeclaredField(NETWORKING_CLIENT).type
                val (call, requestType) = cachedCall(classLoader, client, cache, apk)
                    ?: findCall(client)?.also { (call, request) ->
                        synchronized(cache) {
                            cache.put(CALL_CACHE, apk, "${call.name},${request.name}")
                            cache.save()
                        }
                    }
                    ?: return null
                val request = instanceFields(call).firstOrNull { it.type == requestType } ?: return null
                val response = instanceMethods(call)
                    .filter { it.parameterCount == 0 && holds(it.returnType, requestType) }
                    .map { it.returnType }
                    .distinct()
                    .singleOrNull() ?: return null
                val responses = ShrunkResponses.resolve(response, requestType) ?: return null
                request.isAccessible = true
                ShrunkCalls(call, request, responses)
            }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to recognise Discord's networking classes", it) }
                .getOrNull()

            private fun cachedCall(
                classLoader: ClassLoader,
                client: Class<*>,
                cache: StartupCache,
                apk: File,
            ): Pair<Class<*>, Class<*>>? {
                val names = synchronized(cache) { cache.get(CALL_CACHE, apk) }?.split(',')?.takeIf { it.size == 2 } ?: return null
                val call = runCatching { Class.forName(names[0], false, classLoader) }.getOrNull() ?: return null
                val request = callRequest(call, client)?.takeIf { it.name == names[1] } ?: return null
                return call to request
            }

            private fun findCall(client: Class<*>): Pair<Class<*>, Class<*>>? {
                val nearby = referencedTypes(client)
                return (nearby.asSequence() + nearby.asSequence().flatMap { referencedTypes(it).asSequence() })
                    .firstNotNullOfOrNull { type -> callRequest(type, client)?.let { type to it } }
            }

            private fun referencedTypes(type: Class<*>): Set<Class<*>> =
                (
                    instanceFields(type).map { it.type } +
                        instanceMethods(type).flatMap { it.parameterTypes.toList() + it.returnType }
                    ).filterNot { it.isPrimitive || it.isArray || it.name.startsWith("java.") }
                    .toSet()

            private fun callRequest(type: Class<*>, client: Class<*>): Class<*>? = type.declaredConstructors
                .map { it.parameterTypes }
                .firstOrNull { it.size == 3 && it[0] == client && it[2] == Boolean::class.javaPrimitiveType }
                ?.get(1)

            private fun holds(type: Class<*>, member: Class<*>) =
                !type.isPrimitive && instanceFields(type).any { it.type == member }
        }
    }

    private class ShrunkResponses(
        val response: Class<*>,
        private val builder: Constructor<*>,
        private val build: Method,
        private val request: Field,
        private val protocol: Field,
        private val http11: Any,
        private val code: Field,
        private val message: Field,
        private val bodyField: Field,
    ) {
        val body: Class<*> get() = bodyField.type

        fun noContent(original: Any, emptyBody: Any?): Any? = runCatching {
            val response = builder.newInstance()
            request.set(response, original)
            protocol.set(response, http11)
            code.setInt(response, NO_CONTENT)
            message.set(response, "No Content")
            if (emptyBody != null) bodyField.set(response, emptyBody)
            build.invoke(response)
        }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to answer an analytics request locally", it) }
            .getOrNull()

        companion object {
            fun resolve(response: Class<*>, requestType: Class<*>): ShrunkResponses? {
                val type = instanceMethods(response)
                    .filter { it.parameterCount == 0 }
                    .map { it.returnType }
                    .firstOrNull { candidate -> isBuilder(candidate, response) } ?: return null
                val fields = instanceFields(type)
                val request = fields.singleOrNull { it.type == requestType } ?: return null
                val protocol = fields.singleOrNull { it.type.isEnum } ?: return null
                val http11 = protocol.type.enumConstants?.firstOrNull { it.toString() == "http/1.1" } ?: return null
                val code = fields.singleOrNull { it.type == Int::class.javaPrimitiveType } ?: return null
                val message = fields.singleOrNull { it.type == String::class.java } ?: return null
                val body = fields.singleOrNull { field ->
                    Modifier.isAbstract(field.type.modifiers) && !field.type.isInterface &&
                        Closeable::class.java.isAssignableFrom(field.type)
                } ?: return null
                val build = instanceMethods(type).first { it.parameterCount == 0 && it.returnType == response }
                val constructor = type.getDeclaredConstructor()
                listOf(request, protocol, code, message, body).forEach { it.isAccessible = true }
                constructor.isAccessible = true
                build.isAccessible = true
                return ShrunkResponses(response, constructor, build, request, protocol, http11, code, message, body)
            }

            private fun isBuilder(type: Class<*>, response: Class<*>): Boolean =
                !type.isPrimitive && runCatching { type.getDeclaredConstructor() }.isSuccess &&
                    instanceMethods(type).any { it.parameterCount == 0 && it.returnType == response }
        }
    }

    private class EmptyBody(
        private val classLoader: ClassLoader,
        private val bodyType: Class<*>,
        private val cache: StartupCache,
        private val apk: File,
    ) {
        val value: Any? by lazy {
            runCatching(::create)
                .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to build an empty analytics response body", it) }
                .getOrNull()
                .also { body ->
                    if (body == null) {
                        Logger.warning(LogCategory.DEFAULT, "Answering analytics requests without a response body.")
                    } else {
                        Logger.debug(LogCategory.DEFAULT, "Answering analytics requests with an empty ${body.javaClass.name}.")
                    }
                }
        }

        private fun create(): Any? {
            val source = instanceMethods(bodyType).firstOrNull { method ->
                method.parameterCount == 0 && method.returnType.isInterface &&
                    ReadableByteChannel::class.java.isAssignableFrom(method.returnType)
            }?.returnType ?: return null
            val cached = synchronized(cache) { cache.get(EMPTY_BODY_CACHE, apk) }?.split(',')
            val (bodyClass, bufferClass) = cached?.takeIf { it.size == 2 }
                ?.let { (body, buffer) -> load(body) to load(buffer) }
                ?.takeIf { (body, buffer) -> body != null && buffer != null }
                ?.let { (body, buffer) -> body!! to buffer!! }
                ?: (find(packageOf(bodyType)) { isBody(it, source) } to find(packageOf(source)) { isBuffer(it, source) })
                    .takeIf { (body, buffer) -> body != null && buffer != null }
                    ?.let { (body, buffer) -> body!! to buffer!! }
                    ?.also { (body, buffer) ->
                        synchronized(cache) {
                            cache.put(EMPTY_BODY_CACHE, apk, "${body.name},${buffer.name}")
                            cache.save()
                        }
                    }
                ?: return null
            val buffer = allocate(bufferClass)
            val constructor = bodyClass.declaredConstructors.first { isBodyConstructor(it, source) }
            constructor.isAccessible = true
            val arguments = constructor.parameterTypes.map { type ->
                when {
                    type == source -> buffer
                    type == Long::class.javaPrimitiveType -> 0L
                    type == Int::class.javaPrimitiveType -> 0
                    type == Boolean::class.javaPrimitiveType -> false
                    else -> null
                }
            }
            return constructor.newInstance(*arguments.toTypedArray())
        }

        private fun packageOf(type: Class<*>) = type.name.substringBeforeLast('.', "")

        private fun load(name: String): Class<*>? = runCatching { Class.forName(name, false, classLoader) }.getOrNull()

        private fun find(packageName: String, matches: (Class<*>) -> Boolean): Class<*>? {
            val prefix = if (packageName.isEmpty()) "" else "$packageName."
            return shrunkNames().firstNotNullOfOrNull { name -> load(prefix + name)?.takeIf(matches) }
        }

        private fun shrunkNames(): Sequence<String> {
            val letters = ('a'..'z').map(Char::toString)
            return letters.asSequence() + (0..9).asSequence().flatMap { digit -> letters.map { "$it$digit" } }
        }

        private fun isBody(type: Class<*>, source: Class<*>) =
            bodyType.isAssignableFrom(type) && !Modifier.isAbstract(type.modifiers) &&
                type.declaredConstructors.any { isBodyConstructor(it, source) }

        private fun isBodyConstructor(constructor: Constructor<*>, source: Class<*>) =
            constructor.parameterTypes.any { it == source } &&
                constructor.parameterTypes.any { it == Long::class.javaPrimitiveType }

        private fun isBuffer(type: Class<*>, source: Class<*>) =
            source.isAssignableFrom(type) && ByteChannel::class.java.isAssignableFrom(type) &&
                Cloneable::class.java.isAssignableFrom(type) && !Modifier.isAbstract(type.modifiers) &&
                (type.declaredConstructors.isEmpty() || runCatching { type.getDeclaredConstructor() }.isSuccess)

        private fun allocate(type: Class<*>): Any {
            runCatching { type.getDeclaredConstructor() }.getOrNull()?.let { constructor ->
                constructor.isAccessible = true
                return constructor.newInstance()
            }
            val unsafe = Class.forName("sun.misc.Unsafe")
            val instance = unsafe.getDeclaredField("theUnsafe").also { it.isAccessible = true }.get(null)
            return unsafe.getMethod("allocateInstance", Class::class.java).invoke(instance, type)!!
        }
    }
}
