package com.volam2d.app;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Một tài khoản game. Mỗi lớp con (Game1/2/3) khai báo trong manifest ở tiến trình riêng (:acc1, :acc2, :acc3) và
 * gọi WebView.setDataDirectorySuffix trước khi tạo WebView -> cookie / localStorage / phiên đăng nhập tách biệt,
 * ba tài khoản chạy song song như ba app.
 */
public abstract class GameActivity extends Activity {
    static final String HOST = "volam2d.com";
    static final String URL = "https://" + HOST + "/play?app=android";
    protected abstract int slot();
    private WebView web;

    @Override
    protected void onCreate(Bundle b) {
        if (Build.VERSION.SDK_INT >= 28) {
            try { WebView.setDataDirectorySuffix("acc" + slot()); } catch (Exception ignored) { }
        }
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 21) {
            Bitmap ic = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
            setTaskDescription(new ActivityManager.TaskDescription("Võ Lâm · " + MainActivity.nameOf(this, slot()), ic, 0xff1a0c06));
        }
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " VoLamApp/1 acc" + slot());
        web.setBackgroundColor(0xff0b0810);
        web.setWebChromeClient(new WebChromeClient());   // cho phép hộp thoại alert / confirm / prompt của game
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return external(r.getUrl()); }
            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) { return external(Uri.parse(url)); }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (Build.VERSION.SDK_INT >= 21 && r.isForMainFrame()) offline();
            }
        });
        immersive();
        if (b != null) web.restoreState(b); else web.loadUrl(URL + "&acc=" + slot());
    }

    /** link ngoài game (Zalo, cổng nạp, ...) mở bằng trình duyệt / app tương ứng */
    private boolean external(Uri u) {
        String h = u.getHost();
        if (h != null && (h.equals(HOST) || h.endsWith("." + HOST))) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
        return true;
    }

    private void offline() {
        String html = "<html><body style='margin:0;background:#140a06;color:#f5e6c8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
            + "<div><h2 style='color:#ffd36a'>Mất kết nối</h2><p>Kiểm tra mạng rồi bấm thử lại.</p>"
            + "<a href='" + URL + "&acc=" + slot() + "' style='display:inline-block;padding:12px 28px;background:#e8b048;color:#2a0e02;border-radius:8px;text-decoration:none;font-weight:bold'>Thử lại</a></div></body></html>";
        web.loadDataWithBaseURL("https://" + HOST + "/", html, "text/html", "utf-8", null);
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }

    @Override
    protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }

    @Override
    public void onBackPressed() {
        new AlertDialog.Builder(this)
            .setTitle("Thoát " + MainActivity.nameOf(this, slot()) + "?")
            .setMessage("Nhân vật sẽ rời game (bật Vé Treo Máy để máy chủ treo hộ).")
            .setPositiveButton("Thoát", (d, w) -> { if (Build.VERSION.SDK_INT >= 21) finishAndRemoveTask(); else finish(); })
            .setNeutralButton("Chọn tài khoản khác", (d, w) -> startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)))
            .setNegativeButton("Ở lại", null)
            .show();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
