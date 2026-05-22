package com.aicalendar.widget.api

import com.aicalendar.widget.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.statement.HttpResponse
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

object ApiClient {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    val client: HttpClient = HttpClient(Android) {
        install(ContentNegotiation) { json(this@ApiClient.json) }
    }

    private val base get() = BuildConfig.WEB_BASE_URL

    suspend fun today(token: String): TodayResponse {
        val res: HttpResponse = client.get("$base/api/widget/today") { parameter("token", token) }
        if (!res.status.isSuccess()) error("today ${res.status.value}")
        return res.body()
    }

    suspend fun next(token: String): NextResponse {
        val res: HttpResponse = client.get("$base/api/widget/next") { parameter("token", token) }
        if (!res.status.isSuccess()) error("next ${res.status.value}")
        return res.body()
    }

    suspend fun month(token: String, ym: String? = null): MonthResponse {
        val res: HttpResponse = client.get("$base/api/widget/month") {
            parameter("token", token)
            if (ym != null) parameter("month", ym)
        }
        if (!res.status.isSuccess()) error("month ${res.status.value}")
        return res.body()
    }

    suspend fun reminders(token: String): RemindersResponse {
        val res: HttpResponse = client.get("$base/api/widget/reminders") { parameter("token", token) }
        if (!res.status.isSuccess()) error("reminders ${res.status.value}")
        return res.body()
    }

    /** Quick validity check used by the token entry screen. */
    suspend fun validateToken(token: String): Boolean = runCatching { today(token) }.isSuccess
}
