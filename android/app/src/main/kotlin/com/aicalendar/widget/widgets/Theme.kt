package com.aicalendar.widget.widgets

import androidx.compose.ui.graphics.Color

object WidgetTheme {
    val BG = Color(0xFFFFFFFF)
    val SURFACE_2 = Color(0xFFF1F1EE)
    val FG = Color(0xFF111111)
    val MUTED = Color(0xFF6B6B6B)
    val BORDER = Color(0xFFE7E7E3)
    val ACCENT = Color(0xFF111111)
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
