package com.yeverse.app;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;

/** System document picker owns permissions; exports never need broad storage access. */
@CapacitorPlugin(name = "CollectionDocuments")
public class CollectionDocumentsPlugin extends Plugin {
    private boolean exporting = false;
    @PluginMethod
    public void saveBackup(PluginCall call) {
        if (exporting) { call.reject("已有备份正在导出"); return; }
        try {
            File root = new File(getContext().getCacheDir(), "exports").getCanonicalFile();
            File source = new File(getContext().getCacheDir(), call.getString("path", "")).getCanonicalFile();
            if (!source.getParentFile().equals(root) || !source.isFile()) {
                call.reject("备份临时文件不存在"); return;
            }
            String name = call.getString("name", "yeverse-backup.json");
            if (!name.matches("[A-Za-z0-9._-]+\\.json")) { call.reject("备份名称无效"); return; }
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, name);
            exporting = true;
            startActivityForResult(call, intent, "backupSaved");
        } catch (Exception e) { exporting = false; call.reject("无法打开文件保存窗口", e); }
    }
    @ActivityCallback
    private void backupSaved(PluginCall call, ActivityResult result) {
        if (call == null) { exporting = false; return; }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            exporting = false; JSObject data = new JSObject(); data.put("cancelled", true); call.resolve(data); return;
        }
        var uri = result.getData().getData();
        getBridge().execute(() -> {
            try (InputStream in = new FileInputStream(new File(getContext().getCacheDir(), call.getString("path")));
                 OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new IOException("无法写入所选位置");
                byte[] buffer = new byte[65536]; int count;
                while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                out.flush(); JSObject data = new JSObject(); data.put("cancelled", false); call.resolve(data);
            } catch (Exception e) { call.reject("备份保存失败，请重试", e); }
            finally { exporting = false; }
        });
    }
}
