package com.aicalendar.widget.api

import kotlinx.serialization.Serializable

@Serializable
data class WidgetEvent(
    val id: String,
    val title: String,
    val start_time: String,
    val end_time: String,
    val location_text: String? = null,
    val source_provider: String? = null,
)

@Serializable
data class TodayResponse(val events: List<WidgetEvent>)

@Serializable
data class NextResponse(
    val event: WidgetEvent? = null,
    val recommended_reminder_at: String? = null,
)

@Serializable
data class MonthResponse(
    val month: String,
    val days_with_events: List<String>,
    val holidays: List<String> = emptyList(),
)
