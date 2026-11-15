package in.kaybuilds.dosewell;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String HOME = "file:///android_asset/index.html";
    private static final int RC_FILE = 11, RC_NOTIF = 12;
    private WebView web;
    private FrameLayout root;
    private ValueCallback<Uri[]> fileCb;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.app_bg));
        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.app_bg));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        // The app draws edge to edge on current Android, so keep content clear of the status bar, navigation bar and keyboard.
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
                if (Build.VERSION.SDK_INT >= 30) {
                    Insets i = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                    v.setPadding(i.left, i.top, i.right, i.bottom);
                } else {
                    v.setPadding(in.getSystemWindowInsetLeft(), in.getSystemWindowInsetTop(), in.getSystemWindowInsetRight(), in.getSystemWindowInsetBottom());
                }
                return in;
            }
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setGeolocationEnabled(false);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setBlockNetworkLoads(true);
        WebView.setWebContentsDebuggingEnabled(false);

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest rq) {
                Uri u = rq.getUrl();
                String url = String.valueOf(u);
                if (url.startsWith("file:///android_asset/")) return false;
                String scheme = String.valueOf(u.getScheme());
                // Only hand-offs the user asked for: WhatsApp links, phone, SMS and mail.
                if (scheme.equals("https") || scheme.equals("tel") || scheme.equals("sms") || scheme.equals("mailto")) {
                    try { startActivity(new Intent(scheme.equals("tel") ? Intent.ACTION_DIAL : Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb; cameraUri = null;
                boolean image = false;
                String[] types = p.getAcceptTypes();
                if (types != null) for (String t : types) if (t != null && t.startsWith("image")) image = true;
                if (p.isCaptureEnabled()) {
                    try {
                        File f = new File(ShareProvider.dir(MainActivity.this), "capture.jpg");
                        if (f.exists()) f.delete();
                        Uri out = ShareProvider.uriFor("capture.jpg");
                        Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        cam.putExtra(MediaStore.EXTRA_OUTPUT, out);
                        cam.setClipData(ClipData.newRawUri("photo", out));
                        cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        cameraUri = out;
                        startActivityForResult(cam, RC_FILE);
                        return true;
                    } catch (Exception e) { cameraUri = null; }
                }
                try {
                    Intent pick = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType(image ? "image/*" : "*/*");
                    startActivityForResult(Intent.createChooser(pick, null), RC_FILE);
                    return true;
                } catch (ActivityNotFoundException e) { fileCb = null; return false; }
            }
        });
        web.addJavascriptInterface(new Bridge(), "DosewellNative");

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, new android.window.OnBackInvokedCallback() {
                @Override public void onBackInvoked() { handleBack(); }
            });
        }
        Alarms.ensureChannel(this);
        Alarms.rearm(this);
        if (saved == null) web.loadUrl(HOME); else web.restoreState(saved);
    }

    private void handleBack() {
        web.evaluateJavascript("(window.__dwBack && window.__dwBack()) ? 1 : 0", new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) { if (!"1".equals(v)) moveTaskToBack(true); }
        });
    }

    @Override public void onBackPressed() { handleBack(); }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.__dwResume && window.__dwResume()", null);
    }

    @Override protected void onPause() { web.onPause(); super.onPause(); }

    @Override protected void onDestroy() { root.removeView(web); web.destroy(); super.onDestroy(); }

    @Override
    protected void onActivityResult(int rc, int result, Intent data) {
        super.onActivityResult(rc, result, data);
        if (rc != RC_FILE || fileCb == null) return;
        Uri[] out = null;
        if (result == RESULT_OK) {
            if (data != null && data.getData() != null) out = new Uri[] { data.getData() };
            else if (cameraUri != null && new File(ShareProvider.dir(this), "capture.jpg").length() > 0) out = new Uri[] { cameraUri };
        }
        fileCb.onReceiveValue(out);
        fileCb = null; cameraUri = null;
    }

    @Override
    public void onRequestPermissionsResult(int rc, String[] perms, int[] results) {
        super.onRequestPermissionsResult(rc, perms, results);
        if (rc == RC_NOTIF) web.evaluateJavascript("window.__dwResume && window.__dwResume()", null);
    }

    private boolean notifAllowed() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.areNotificationsEnabled();
    }

    private File recordFile(String id) {
        if (id == null || !id.matches("[A-Za-z0-9_-]{1,24}")) return null;
        File d = new File(getFilesDir(), "records"); d.mkdirs();
        return new File(d, id + ".json");
    }

    private void send(Intent i) {
        try { startActivity(Intent.createChooser(i, null)); } catch (Exception ignored) { }
    }

    private Uri writeShare(String name, byte[] bytes) throws Exception {
        File f = new File(ShareProvider.dir(this), name);
        FileOutputStream o = new FileOutputStream(f);
        try { o.write(bytes); } finally { o.close(); }
        return ShareProvider.uriFor(name);
    }

    /** Everything the page may ask the phone to do. The page is the app's own bundled files only. */
    private final class Bridge {
        @JavascriptInterface public String status() {
            try {
                boolean asked = Alarms.prefs(MainActivity.this).getBoolean("asked", false);
                return new JSONObject().put("supported", true).put("allowed", notifAllowed()).put("asked", asked).put("exact", Alarms.canExact(MainActivity.this)).toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface public void askNotif() {
            runOnUiThread(new Runnable() { @Override public void run() {
                boolean asked = Alarms.prefs(MainActivity.this).getBoolean("asked", false);
                Alarms.prefs(MainActivity.this).edit().putBoolean("asked", true).apply();
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                        && (!asked || shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS))) {
                    requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, RC_NOTIF);
                } else if (!notifAllowed()) {
                    try { startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())); } catch (Exception ignored) { }
                }
            } });
        }

        @JavascriptInterface public void askExact() {
            if (Build.VERSION.SDK_INT < 31) return;
            runOnUiThread(new Runnable() { @Override public void run() {
                try { startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName()))); } catch (Exception ignored) { }
            } });
        }

        @JavascriptInterface public void schedule(String json) { Alarms.replaceAll(MainActivity.this, json); }
        @JavascriptInterface public void cancelAll() { Alarms.cancelAll(MainActivity.this); }
        @JavascriptInterface public String takePending() { return Alarms.takePending(MainActivity.this); }
        @JavascriptInterface public void setSnooze(int minutes) { Alarms.prefs(MainActivity.this).edit().putInt("snooze", Math.max(1, Math.min(120, minutes))).apply(); }

        @JavascriptInterface public void clearDelivered(int id) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) { nm.cancel(id); nm.cancel(id % 1000000000 + 1000000000); }
        }

        @JavascriptInterface public void saveState(String json) { Alarms.prefs(MainActivity.this).edit().putString("state", json).apply(); }
        @JavascriptInterface public String loadState() { return Alarms.prefs(MainActivity.this).getString("state", ""); }

        @JavascriptInterface public String recordIds() {
            JSONArray a = new JSONArray();
            File[] fs = new File(getFilesDir(), "records").listFiles();
            if (fs != null) for (File f : fs) if (f.getName().endsWith(".json")) a.put(f.getName().substring(0, f.getName().length() - 5));
            return a.toString();
        }

        @JavascriptInterface public String readRecord(String id) {
            File f = recordFile(id);
            if (f == null || !f.exists() || f.length() > 2000000) return "";
            try {
                FileInputStream in = new FileInputStream(f);
                try {
                    ByteArrayOutputStream o = new ByteArrayOutputStream();
                    byte[] buf = new byte[16384]; int n;
                    while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
                    return new String(o.toByteArray(), StandardCharsets.UTF_8);
                } finally { in.close(); }
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface public boolean writeRecord(String id, String json) {
            File f = recordFile(id);
            if (f == null || json == null || json.length() > 1000000) return false;
            try {
                File tmp = new File(f.getPath() + ".tmp");
                FileOutputStream o = new FileOutputStream(tmp);
                try { o.write(json.getBytes(StandardCharsets.UTF_8)); } finally { o.close(); }
                return tmp.renameTo(f);
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface public void deleteRecord(String id) { File f = recordFile(id); if (f != null) f.delete(); }

        @JavascriptInterface public void copy(String text) {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Dosewell", text));
        }

        @JavascriptInterface public void shareText(final String text) {
            runOnUiThread(new Runnable() { @Override public void run() { send(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)); } });
        }

        @JavascriptInterface public void shareImage(String base64, final String text) {
            try {
                final Uri u = writeShare("dosewell-streak.png", Base64.decode(base64, Base64.DEFAULT));
                runOnUiThread(new Runnable() { @Override public void run() {
                    Intent i = new Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, u).putExtra(Intent.EXTRA_TEXT, text);
                    i.setClipData(ClipData.newRawUri("streak", u)); i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); send(i);
                } });
            } catch (Exception ignored) { }
        }

        @JavascriptInterface public void shareFile(String name, String text) {
            try {
                String safe = name == null ? "dosewell-backup.json" : name.replaceAll("[^A-Za-z0-9._-]", "_");
                if (safe.startsWith(".") || safe.length() > 80) safe = "dosewell-backup.json";
                final Uri u = writeShare(safe, text.getBytes(StandardCharsets.UTF_8));
                runOnUiThread(new Runnable() { @Override public void run() {
                    Intent i = new Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM, u);
                    i.setClipData(ClipData.newRawUri("backup", u)); i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); send(i);
                } });
            } catch (Exception ignored) { }
        }

        @JavascriptInterface public void bars(final boolean dark, final String color) {
            runOnUiThread(new Runnable() { @Override public void run() {
                int bg = dark ? 0xFF16142A : 0xFFF6F4FB;
                if (color != null && color.matches("#[0-9A-Fa-f]{6}")) { try { bg = android.graphics.Color.parseColor(color); } catch (Exception ignored) { } }
                root.setBackgroundColor(bg); web.setBackgroundColor(bg); getWindow().getDecorView().setBackgroundColor(bg);
                if (Build.VERSION.SDK_INT >= 30) {
                    WindowInsetsController c = getWindow().getInsetsController();
                    int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    if (c != null) c.setSystemBarsAppearance(dark ? 0 : mask, mask);
                } else {
                    View d = getWindow().getDecorView();
                    int f = d.getSystemUiVisibility(), light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    d.setSystemUiVisibility(dark ? f & ~light : f | light);
                }
            } });
        }
    }
}
