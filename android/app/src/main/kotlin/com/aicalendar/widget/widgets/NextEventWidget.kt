package com.aicalendar.widget.widgets

import android.content.Context
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.unit.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.aicalendar.widget.api.ApiClient
import com.aicalendar.widget.api.NextResponse
import com.aicalendar.widget.store.TokenStore
import com.aicalendar.widget.widgets.WidgetTheme.BG
import com.aicalendar.widget.widgets.WidgetTheme.FG
import com.aicalendar.widget.widgets.WidgetTheme.MUTED

class NextEventWidget : GlanceAppWidget() {

    override val sizeMode = androidx.glance.appwidget.SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val token = TokenStore.get(context)
        val data: NextResponse? = if (token == null) null
        else runCatching { ApiClient.next(token) }.getOrNull()

        provideContent {
            GlanceTheme {
                if (token == null) NotConfigured() else NextBody(data)
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun NextBody(data: NextResponse?) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ColorProvider(BG))
            .cornerRadius(20.dp)
            .padding(14.dp)
            .clickable(openApp())
    ) {
        Text(
            "다음 일정",
            style = TextStyle(color = ColorProvider(MUTED), fontSize = 11.sp, fontWeight = FontWeight.Medium)
        )
        Spacer(GlanceModifier.height(4.dp))
        val e = data?.event
        if (e == null) {
            Text("예정된 일정이 없습니다.", style = TextStyle(color = ColorProvider(FG), fontSize = 14.sp))
            return@Column
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            ProviderDot(e.source_provider)
            Spacer(GlanceModifier.width(6.dp))
            Text(
                e.title,
                maxLines = 1,
                style = TextStyle(color = ColorProvider(FG), fontSize = 16.sp, fontWeight = FontWeight.Bold)
            )
        }
        Spacer(GlanceModifier.height(2.dp))
        Text(
            TimeFmt.short(e.start_time),
            style = TextStyle(color = ColorProvider(MUTED), fontSize = 13.sp)
        )
        e.location_text?.let {
            Spacer(GlanceModifier.height(2.dp))
            Text(it, maxLines = 1, style = TextStyle(color = ColorProvider(MUTED), fontSize = 12.sp))
        }
        data?.recommended_reminder_at?.let { reminderIso ->
            Spacer(GlanceModifier.height(6.dp))
            Box(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .background(ColorProvider(WidgetTheme.SURFACE_2))
                    .cornerRadius(10.dp)
                    .padding(horizontal = 8.dp, vertical = 5.dp)
            ) {
                Text(
                    "알림 ${TimeFmt.short(reminderIso)}",
                    style = TextStyle(color = ColorProvider(FG), fontSize = 11.sp)
                )
            }
        }
    }
}

class NextEventWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NextEventWidget()
}
