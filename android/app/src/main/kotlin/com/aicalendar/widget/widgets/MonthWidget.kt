package com.aicalendar.widget.widgets

import android.content.Context
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
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
import kotlinx.coroutines.withTimeoutOrNull
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

// Absolute target month ("yyyy-MM") passed straight to the nav action, so the
// action never has to read DataStore (unreliable in its short-lived context).
private val TARGET_MONTH = ActionParameters.Key<String>("target_month")
// The day ("yyyy-MM-dd") a tapped cell hands to the day-detail action.
private val TARGET_DAY = ActionParameters.Key<String>("target_day")

class MonthWidget : GlanceAppWidget() {

    // Single layout (default) — more robust for the dense grid; fillMaxSize still
    // stretches the content when the widget is resized.
    override val sizeMode = SizeMode.Single

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val token = TokenStore.get(context)
        val today = LocalDate.now(ZoneId.of("Asia/Seoul"))
        val displayed = YearMonth.parse(TokenStore.getDisplayedMonth(context))
        val ym = "%04d-%02d".format(displayed.year, displayed.monthValue)
        // Time-box the fetch so a slow/unreachable API never blocks the render —
        // the month label & grid must always paint so navigation feels instant.
        val resp = if (token == null) null
        else runCatching { withTimeoutOrNull(4000) { ApiClient.month(token, ym) } }.getOrNull()
        val holidays = resp?.holidays?.toSet() ?: emptySet()
        val daysWith = resp?.days_with_events?.toSet() ?: emptySet()
        val byDay = HashMap<String, MutableList<MonthEvent>>()
        resp?.events?.forEach { ev ->
            byDay.getOrPut(TimeFmt.yyyymmdd(ev.start_time)) { mutableListOf() }.add(ev)
        }

        // A selected day is only meaningful while it belongs to the month we just
        // fetched (cells are only tappable within the displayed month).
        val selectedDay = TokenStore.getSelectedDay(context)?.takeIf { it.startsWith(ym) }

        provideContent {
            GlanceTheme {
                when {
                    token == null -> NotConfigured()
                    selectedDay != null -> DayBody(selectedDay, byDay[selectedDay].orEmpty())
                    else -> MonthBody(today, displayed, holidays, daysWith, byDay)
                }
            }
        }
    }
}

/** Tap on < or > — pin the displayed month to the target passed in the action. */
class GoMonthAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val target = parameters[TARGET_MONTH] ?: return
        TokenStore.setDisplayedMonth(context, target)
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
        TokenStore.resetDisplayedMonth(context)
        MonthWidget().update(context, glanceId)
    }
}

/** Tap a day cell — show that day's event list inside the widget. */
class OpenDayAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val day = parameters[TARGET_DAY] ?: return
        TokenStore.setSelectedDay(context, day)
        MonthWidget().update(context, glanceId)
    }
}

/** Tap the back chip in the day view — return to the month grid. */
class BackToMonthAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        TokenStore.clearSelectedDay(context)
        MonthWidget().update(context, glanceId)
    }
}

@androidx.compose.runtime.Composable
private fun MonthBody(
    today: LocalDate,
    displayed: YearMonth,
    holidays: Set<String>,
    daysWith: Set<String>,
    byDay: Map<String, List<MonthEvent>>
) {
    val firstWeekday = (displayed.atDay(1).dayOfWeek.value % 7) // 0=Sun … 6=Sat
    val daysInMonth = displayed.lengthOfMonth()
    val totalCells = ((firstWeekday + daysInMonth + 6) / 7) * 7
    val sameMonthAsToday = displayed.year == today.year && displayed.monthValue == today.monthValue
    val prevMonth = displayed.minusMonths(1).toString() // "yyyy-MM"
    val nextMonth = displayed.plusMonths(1).toString()

    // NOTE: the whole grid is intentionally NOT clickable. A full-area
    // clickable parent swallows taps on the nested < / > buttons (the parent's
    // open-app action fires instead), which is why month nav appeared dead.
    // Open-app affordances live on the title and the day cells instead.
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetTheme.bg)
            .cornerRadius(20.dp)
            .padding(10.dp)
    ) {
        // Header: <  title  >  …  [today]  +
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            // Prev-month button (large tap target for reliable taps)
            Box(
                modifier = GlanceModifier
                    .height(40.dp)
                    .width(40.dp)
                    .cornerRadius(20.dp)
                    .background(WidgetTheme.surface2)
                    .clickable(actionRunCallback<GoMonthAction>(actionParametersOf(TARGET_MONTH to prevMonth))),
                contentAlignment = Alignment.Center
            ) {
                Text("‹", style = TextStyle(color = WidgetTheme.fg, fontSize = 20.sp, fontWeight = FontWeight.Bold))
            }
            Spacer(GlanceModifier.width(4.dp))
            Text(
                "${displayed.year}년 ${displayed.monthValue}월",
                modifier = GlanceModifier
                    .clickable(openCalendar())
                    .padding(horizontal = 4.dp, vertical = 6.dp),
                style = TextStyle(color = WidgetTheme.fg, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            )
            Spacer(GlanceModifier.width(4.dp))
            // Next-month button (large tap target for reliable taps)
            Box(
                modifier = GlanceModifier
                    .height(40.dp)
                    .width(40.dp)
                    .cornerRadius(20.dp)
                    .background(WidgetTheme.surface2)
                    .clickable(actionRunCallback<GoMonthAction>(actionParametersOf(TARGET_MONTH to nextMonth))),
                contentAlignment = Alignment.Center
            ) {
                Text("›", style = TextStyle(color = WidgetTheme.fg, fontSize = 20.sp, fontWeight = FontWeight.Bold))
            }
            Spacer(GlanceModifier.defaultWeight())
            if (!sameMonthAsToday) {
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

                    // Always apply a background so RemoteViews emits a fresh
                    // setBackground each render. Without this, a previous "today"
                    // cell can keep its accent background on the next day because
                    // Glance's modifier diff doesn't generate a clear instruction
                    // when the modifier is simply absent.
                    var cellMod = GlanceModifier
                        .defaultWeight()
                        .fillMaxHeight()
                        .padding(1.dp)
                        .cornerRadius(6.dp)
                        .background(if (isToday) WidgetTheme.accent else WidgetTheme.bg)
                    // Tapping an in-month day shows that day's event list inside
                    // the widget (no jump out to the web app).
                    if (inMonth) cellMod = cellMod.clickable(
                        actionRunCallback<OpenDayAction>(actionParametersOf(TARGET_DAY to ymd))
                    )

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

/** In-widget detail view for a single day: a back chip + the day's event list. */
@androidx.compose.runtime.Composable
private fun DayBody(day: String, events: List<MonthEvent>) {
    val date = runCatching { LocalDate.parse(day) }.getOrNull()
    val dow = date?.let { listOf("월", "화", "수", "목", "금", "토", "일")[it.dayOfWeek.value - 1] }
    val title = if (date != null) "${date.monthValue}월 ${date.dayOfMonth}일 ($dow)" else day

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetTheme.bg)
            .cornerRadius(20.dp)
            .padding(10.dp)
    ) {
        // Header: [‹ 달력]   title
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = GlanceModifier
                    .height(36.dp)
                    .cornerRadius(18.dp)
                    .background(WidgetTheme.surface2)
                    .padding(horizontal = 12.dp)
                    .clickable(actionRunCallback<BackToMonthAction>()),
                contentAlignment = Alignment.Center
            ) {
                Text("‹ 달력", style = TextStyle(color = WidgetTheme.fg, fontSize = 12.sp, fontWeight = FontWeight.Medium))
            }
            Spacer(GlanceModifier.width(10.dp))
            Text(title, style = TextStyle(color = WidgetTheme.fg, fontSize = 14.sp, fontWeight = FontWeight.Bold))
        }
        Spacer(GlanceModifier.height(8.dp))

        if (events.isEmpty()) {
            Text("일정이 없습니다.", style = TextStyle(color = WidgetTheme.muted, fontSize = 13.sp))
        } else {
            LazyColumn(modifier = GlanceModifier.fillMaxSize()) {
                items(events) { e ->
                    Row(
                        modifier = GlanceModifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            if (e.all_day) "종일" else TimeFmt.short(e.start_time),
                            style = TextStyle(color = WidgetTheme.blue, fontSize = 12.sp),
                            modifier = GlanceModifier.width(48.dp)
                        )
                        Spacer(GlanceModifier.width(8.dp))
                        Text(
                            e.title,
                            maxLines = 2,
                            style = TextStyle(color = WidgetTheme.fg, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        )
                    }
                }
            }
        }
    }
}

class MonthWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = MonthWidget()
}
