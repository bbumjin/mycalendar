package com.aicalendar.widget.widgets

import androidx.glance.unit.ColorProvider
import com.aicalendar.widget.R

// Resource-backed colors → Android auto-resolves values/ vs values-night/ for dark mode.
object WidgetTheme {
    val bg = ColorProvider(R.color.widget_bg)
    val fg = ColorProvider(R.color.widget_fg)
    val muted = ColorProvider(R.color.widget_muted)
    val accent = ColorProvider(R.color.widget_accent)
    val surface2 = ColorProvider(R.color.widget_surface2)
    val red = ColorProvider(R.color.widget_red)
    val blue = ColorProvider(R.color.widget_blue)
}

object TimeFmt {
    /** "2026-05-19T15:00:00+09:00" -> "15:00" (KST, 24-hour). */
    fun short(iso: String): String {
        return try {
            val instant = java.time.OffsetDateTime.parse(iso)
            val seoul = instant.atZoneSameInstant(java.time.ZoneId.of("Asia/Seoul"))
            "%02d:%02d".format(seoul.hour, seoul.minute)
        } catch (_: Exception) {
            iso
        }
    }

    fun yyyymmdd(iso: String): String {
        return try {
            val odt = java.time.OffsetDateTime.parse(iso)
            val seoul = odt.atZoneSameInstant(java.time.ZoneId.of("Asia/Seoul"))
            "%04d-%02d-%02d".format(seoul.year, seoul.monthValue, seoul.dayOfMonth)
        } catch (_: Exception) {
            iso.take(10)
        }
    }
}
