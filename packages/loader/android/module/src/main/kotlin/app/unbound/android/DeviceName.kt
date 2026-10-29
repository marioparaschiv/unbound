package app.unbound.android

import android.content.Context
import android.os.Build
import android.provider.Settings

object DeviceName {
    private val MARKET_NAME_PROPERTIES = listOf(
        "ro.product.marketname",
        "ro.product.vendor.marketname",
        "ro.product.odm.marketname",
        "ro.vendor.oplus.market.name",
        "ro.config.marketing_name",
        "ro.product.model.display",
    )

    private val PERSONAL_NAME = Regex("""['’]|\bof\b|\bmy\b""", RegexOption.IGNORE_CASE)

    fun brand(manufacturer: String): String =
        manufacturer.trim().replaceFirstChar { it.uppercaseChar() }

    fun isPersonal(name: String): Boolean = PERSONAL_NAME.containsMatchIn(name)

    fun label(manufacturer: String, model: String, marketName: String?, deviceName: String?): String {
        val brand = brand(manufacturer)
        val name = marketName?.trim()?.takeIf { it.isNotEmpty() }
            ?: deviceName?.trim()?.takeIf { it.isNotEmpty() && !isPersonal(it) }

        if (name == null || name.equals(model, ignoreCase = true)) {
            return "$brand $model".trim()
        }

        val branded = if (name.startsWith(brand, ignoreCase = true)) name else "$brand $name"

        return if (branded.contains(model, ignoreCase = true)) branded else "$branded ($model)"
    }

    private fun systemProperty(key: String): String? = runCatching {
        Class.forName("android.os.SystemProperties")
            .getMethod("get", String::class.java)
            .invoke(null, key) as? String
    }.getOrNull()?.takeIf { it.isNotBlank() }

    private fun deviceName(context: Context?): String? = context?.let {
        runCatching { Settings.Global.getString(it.contentResolver, Settings.Global.DEVICE_NAME) }
            .getOrNull()
    }

    fun current(context: Context?): String = label(
        Build.MANUFACTURER,
        Build.MODEL,
        MARKET_NAME_PROPERTIES.firstNotNullOfOrNull(::systemProperty),
        deviceName(context),
    )
}
