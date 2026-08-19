package com.blackhole21.game;

import android.content.Context;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class PushTokenRegistrar {
    private static final String TAG = "BlackHole21";
    private static final String ENDPOINT = "https://black-hole-21.onrender.com/api/push/register";

    private PushTokenRegistrar() {}

    static void send(Context context, String token) {
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(ENDPOINT);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Accept", "application/json");

                String json = "{\"token\":\"" + escapeJson(token) + "\"}";
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(json.getBytes(StandardCharsets.UTF_8));
                }

                int status = connection.getResponseCode();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                String response = readResponse(stream);

                if (status >= 200 && status < 300) {
                    Log.d(TAG, "[push] FCM token registered with backend: HTTP " + status + " " + response);
                } else {
                    Log.e(TAG, "[push] backend token registration failed: HTTP " + status + " " + response);
                }
            } catch (Exception e) {
                Log.e(TAG, "[push] backend token registration request failed", e);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "BlackHole21-PushRegister").start();
    }

    private static String readResponse(InputStream stream) {
        if (stream == null) return "";
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            StringBuilder result = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
            return result.toString();
        } catch (Exception e) {
            return "<unable to read response>";
        }
    }

    private static String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
