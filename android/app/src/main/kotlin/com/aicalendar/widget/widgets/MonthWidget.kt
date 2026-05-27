package com.aicalendar.widget.widgets

import android.content.Context
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.ActionParameters
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.aicalendar.widget.api.ApiClient
import com.aicalendar.widget.api.MonthEvent
import com.aicalendar.widget.store.TokenStore
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

class MonthWidget : GlanceAppWidget() {

    // Single layout (default) — more robust for the dense grid; fillMaxSize still
    // stretches the content when the widget is resized.
    override val sizeMode = SizeMode.Single

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val token = TokenStore.get(context)
        val today = LocalDate.now(ZoneId.of("Asia/Seoul"))
        val offset = TokenStore.getMonthOffset(context)
        val displayed = YearMonth.from(today).plusMonths(offset.toLong())
        val ym = "%04d-%02d".format(displayed.year, displayed.monthValue)
        val resp = if (token == null) null
        else runCatching { ApiClient.month(token, ym) }.getOrNull()
        val holidays = resp?.holidays?.toSet() ?: emptySet()
        val daysWith = resp?.days_with_events?.toSet() ?: emptySet()
        val byDay = HashMap<String, MutableList<MonthEvent>>()
        resp?.events?.forEach { ev ->
            byDay.getOrPut(TimeFmt.yyyymmdd(ev.start_time)) { mutableListOf() }.add(ev)
        }

        provideContent {
            GlanceTheme {
                if (token == null) NotConfigured()
                else MonthBody(today, displayed, offset, holidays, daysWith, byDay)
            }
        }
    }
}

/** Tap on < — shift displayed month back by one and refresh the widget. */
class PrevMonthAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        TokenStore.setMonthOffset(context, TokenStore.getMonthOffset(context) - 1)
        MonthWidget().update(context, glanceId)
    }
}

/** Tap on > — shift displayed month forward by one and refresh the widget. */
class NextMonthAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        TokenStore.setMonthOffset(context, TokenStore.getMonthOffset(context) + 1)
        MonthWidget().update(context, glanceId)
    }
}

/** Tap on the "오늘" chip — reset back to the current month. */
class ResetMonthAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        TokenStore.setMonthOffset(context, 0)
        MonthWidget().update(context, glanceId)
    }
}

@androidx.compose.runtime.Composable
private fun MonthBody(
    today: LocalDate,
    displayed: YearMonth,
    offset: Int,
    holidays: Set<String>,
    daysWith: Set<String>,
    byDay: Map<String, List<MonthEvent>>
) {
    val firstWeekday = (displayed.atDay(1).dayOfWeek.value % 7) // 0=Sun … 6=Sat
    val daysInMonth = displayed.lengthOfMonth()
    val totalCells = ((firstWeekday + daysInMonth + 6) / 7) * 7
    val sameMonthAsToday = displayed.year == today.year && displayed.monthValue == today.monthValue

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetTheme.bg)
            .cornerRadius(20.dp)
            .padding(10.dp)
            .clickable(openCalendar())
    ) {
        // Header: <  title  >  …  [today]  +
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            // Prev-month button
            Box(
                modifier = GlanceModifier
                    .height(28.dp)
                    .width(28.dp)
                    .cornerRadius(14.dp)
                    .background(WidgetTheme.surface2)
                    .clickable(actionRunCallback<PrevMonthAction>()),
                contentAlignment = Alignment.Center
            ) {
                Text("<", style = TextStyle(color = WidgetTheme.fg, fontSize = 16.sp, fontWeight = FontWeight.Bold))
            }
            Spacer(GlanceModifier.width(6.dp))
            Text(
                "${displayed.year}년 ${displayed.monthValue}월",
                style = TextStyle(color = WidgetTheme.fg, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            )
            Spacer(GlanceModifier.width(6.dp))
            // Next-month button
            Box(
                modifier = GlanceModifier
                    .height(28.dp)
                    .width(28.dp)
                    .cornerRadius(14.dp)
                    .background(WidgetTheme.surface2)
                    .clickable(actionRunCallback<NextMonthAction>()),
                contentAlignment = Alignment.Center
            ) {
                Text(">", style = TextStyle(color = WidgetTheme.fg, fontSize = 16.sp, fontWeight = FontWeight.Bold))
            }
            Spacer(GlanceModifier.defaultWeight())
            if (offset != 0) {
                Box(
                    modifier = GlanceModifier
                        .height(26.dp)
                        .cornerRadius(13.dp)
                        .background(WidgetTheme.surface2)
                        .padding(horizontal = 10.dp)
                        .clickable(actionRunCallback<ResetMonthAction>()),
                    contentAlignment = Alignment.Center
                ) {
                    Text("오늘", style = TextStyle(color = WidgetTheme.fg, fontSize = 11.sp, fontWeight = FontWeight.Medium))
                }
                Spacer(GlanceModifier.width(6.dp))
            }
            Box(
                modifier = GlanceModifier
                    .height(28.dp)
                    .width(28.dp)
                    .cornerRadius(14.dp)
                    .background(WidgetTheme.accent)
                    .clickable(openQuickAdd()),
                contentAlignment = Alignment.Center
            ) {
                Text("＋", style = TextStyle(color = WidgetTheme.bg, fontSize = 16.sp, fontWeight = FontWeight.Bold))
            }
        }
        Spacer(GlanceModifier.height(6.dp))

        // Day-of-week header (both weekend days red)
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            listOf("일", "월", "화", "수", "목", "금", "토").forEachIndexed { i, d ->
                val c = if (i == 0 || i == 6) WidgetTheme.red else WidgetTheme.muted
                Box(modifier = GlanceModifier.defaultWeight(), contentAlignment = Alignment.Center) {
                    Text(d, style = TextStyle(color = c, fontSize = 9.sp))
                }
            }
        }
        Spacer(GlanceModifier.height(2.dp))

        var cellIndex = 0
        while (cellIndex < totalCells) {
            Row(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
                for (col in 0 until 7) {
                    val day = cellIndex - firstWeekday + 1
                    val inMonth = day in 1..daysInMonth
                    val isToday = inMonth && sameMonthAsToday && day == today.dayOfMonth
                    val ymd = if (inMonth)
                        "%04d-%02d-%02d".format(displayed.year, displayed.monthValue, day)
                    else ""
                    val isHoliday = inMonth && holidays.contains(ymd)
                    val dayEvents = if (inMonth) byDay[ymd].orEmpty() else emptyList()

                    val numColor = when {
                        isToday -> WidgetTheme.bg
                        isHoliday || col == 0 || col == 6 -> WidgetTheme.red
                        else -> WidgetTheme.fg
                    }
                    // Event time/+N rendered in blue on non-today cells (compensates
                    // for losing the Saturday-blue treatment that moved to red).
                    val subColor = if (isToday) WidgetTheme.bg else WidgetTheme.blue

                    var cellMod = GlanceModifier.defaultWeight().fillMaxHeight().padding(1.dp)
                    if (isToday) cellMod = cellMod.cornerRadius(6.dp).background(WidgetTheme.accent)
                    // Tapping an in-month day opens that day's event list.
                    if (inMonth) cellMod = cellMod.clickable(openDay(ymd))

                    Box(modifier = cellMod) {
                        if (inMonth) {
                            Column(modifier = GlanceModifier.fillMaxSize().padding(horizontal = 2.dp, vertical = 1.dp)) {
                                Text(
                                    day.toString(),
                                    style = TextStyle(
                                        color = numColor,
                                        fontSize = 10.sp,
                                        fontWeight = if (isToday || isHoliday) FontWeight.Bold else FontWeight.Normal
                                    )
                                )
                                if (dayEvents.isNotEmpty()) {
                                    // First event's time (most informative), then a small +N.
                                    val first = dayEvents.first()
                                    Text(
                                        if (first.all_day) "종일" else TimeFmt.short(first.start_time),
                                        maxLines = 1,
                                        style = TextStyle(color = subColor, fontSize = 8.sp)
                                    )
                                    if (dayEvents.size > 1) {
                                        Text("+${dayEvents.size - 1}", style = TextStyle(color = subColor, fontSize = 8.sp))
                                    }
                                } else if (daysWith.contains(ymd)) {
                                    // Fallback: event data didn't load — at least mark the day with a dot.
                                    Text("•", style = TextStyle(color = subColor, fontSize = 10.sp))
                                }
                            }
                        }
                    }
                    cellIndex++
                }
            }
        }
    }
}

class MonthWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = MonthWidget()
}
