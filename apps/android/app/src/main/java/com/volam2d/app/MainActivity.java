package com.volam2d.app;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputFilter;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.List;

/** Màn chọn tài khoản: 3 nút, mỗi nút mở một tài khoản riêng (giữ chạm để đặt tên gợi nhớ). */
public class MainActivity extends Activity {
    static final Class<?>[] GAMES = { Game1.class, Game2.class, Game3.class };

    static String nameOf(Context c, int slot) {
        String n = c.getSharedPreferences("acc", MODE_PRIVATE).getString("n" + slot, "");
        return n.isEmpty() ? "Tài khoản " + slot : n;
    }

    private LinearLayout list;

    private int dp(float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics())); }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        ScrollView sv = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(24), dp(28), dp(24), dp(24));
        sv.addView(root);

        ImageView ic = new ImageView(this);
        ic.setImageResource(R.mipmap.ic_launcher);
        root.addView(ic, new LinearLayout.LayoutParams(dp(84), dp(84)));

        TextView t = new TextView(this);
        t.setText("VÕ LÂM 2D");
        t.setTextColor(0xffffd36a); t.setTextSize(30); t.setTypeface(Typeface.SERIF, Typeface.BOLD); t.setLetterSpacing(0.12f);
        t.setGravity(Gravity.CENTER); t.setPadding(0, dp(10), 0, 0);
        root.addView(t);

        TextView st = new TextView(this);
        st.setText("Chọn tài khoản để vào game\n3 tài khoản chạy song song – chuyển qua lại bằng nút đa nhiệm");
        st.setTextColor(0xffc8b08a); st.setTextSize(13); st.setGravity(Gravity.CENTER); st.setPadding(0, dp(6), 0, dp(18));
        root.addView(st);

        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        root.addView(list, new LinearLayout.LayoutParams(Math.min(dp(420), getResources().getDisplayMetrics().widthPixels - dp(48)), LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView tip = new TextView(this);
        tip.setText(Build.VERSION.SDK_INT >= 28
            ? "Giữ chạm vào một nút để đặt tên gợi nhớ (VD: tên nhân vật)."
            : "Máy Android dưới 9 chỉ hỗ trợ 1 tài khoản (hệ điều hành không tách được dữ liệu trình duyệt).");
        tip.setTextColor(0xff9a8a70); tip.setTextSize(12); tip.setGravity(Gravity.CENTER); tip.setPadding(0, dp(14), 0, dp(8));
        root.addView(tip);

        TextView links = new TextView(this);
        links.setText("💬 Nhóm Zalo cộng đồng   ·   🌐 Trang chủ");
        links.setTextColor(0xff8ec8ff); links.setTextSize(13); links.setGravity(Gravity.CENTER); links.setPadding(0, dp(6), 0, 0);
        links.setOnClickListener(v -> new AlertDialog.Builder(this).setItems(new String[]{ "Nhóm Zalo", "Trang chủ volam2d.com" }, (d, i) -> {
            String u = i == 0 ? "https://zalo.me/g/fkxw5crl6ksc0jotbzgp" : "https://volam2d.com/";
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); } catch (Exception ignored) { }
        }).show());
        root.addView(links);
        setContentView(sv);
    }

    @Override
    protected void onResume() { super.onResume(); build(); }

    /** tài khoản nào đang mở (có task trong đa nhiệm) */
    private boolean running(int slot) {
        if (Build.VERSION.SDK_INT < 23) return false;
        try {
            List<ActivityManager.AppTask> ts = ((ActivityManager) getSystemService(ACTIVITY_SERVICE)).getAppTasks();
            for (ActivityManager.AppTask at : ts) {
                ComponentName c = at.getTaskInfo().baseActivity;
                if (c != null && c.getClassName().equals(GAMES[slot - 1].getName())) return true;
            }
        } catch (Exception ignored) { }
        return false;
    }

    private void build() {
        list.removeAllViews();
        int n = Build.VERSION.SDK_INT >= 28 ? 3 : 1;
        for (int i = 1; i <= n; i++) {
            final int slot = i;
            Button bt = new Button(this);
            bt.setAllCaps(false);
            bt.setText("⚔  " + nameOf(this, slot) + (running(slot) ? "   • đang mở" : ""));
            bt.setTextColor(0xff2a0e02); bt.setTextSize(19); bt.setTypeface(Typeface.SERIF, Typeface.BOLD);
            bt.setBackgroundResource(R.drawable.btn);
            bt.setPadding(dp(16), dp(14), dp(16), dp(14));
            bt.setOnClickListener(v -> open(slot));
            bt.setOnLongClickListener(v -> { rename(slot); return true; });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.setMargins(0, dp(8), 0, dp(8));
            list.addView(bt, lp);
        }
    }

    private void open(int slot) {
        Intent it = new Intent(this, GAMES[slot - 1]);
        it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(it);
    }

    private void rename(int slot) {
        EditText in = new EditText(this);
        in.setHint("Tài khoản " + slot);
        String cur = getSharedPreferences("acc", MODE_PRIVATE).getString("n" + slot, "");
        in.setText(cur); in.setSingleLine(); in.setFilters(new InputFilter[]{ new InputFilter.LengthFilter(20) });
        new AlertDialog.Builder(this).setTitle("Đặt tên cho tài khoản " + slot).setView(in)
            .setPositiveButton("Lưu", (d, w) -> {
                SharedPreferences.Editor e = getSharedPreferences("acc", MODE_PRIVATE).edit();
                e.putString("n" + slot, in.getText().toString().trim()).apply();
                build();
            })
            .setNegativeButton("Huỷ", null).show();
    }
}
