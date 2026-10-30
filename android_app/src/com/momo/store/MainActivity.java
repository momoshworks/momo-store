package com.momo.store;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {

    private WebView webView;
    private ProgressBar progressBar;
    private static final String STORE_URL = "https://momoshworks.github.io/momo-store/";
    private static final String OFFLINE_URL = "file:///android_asset/index.html";

    private Map<Long, String> downloadFileMap = new HashMap<Long, String>();

    private BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (downloadId != -1) {
                String fileName = downloadFileMap.get(downloadId);
                triggerInstallForDownload(downloadId, fileName);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = (WebView) findViewById(R.id.webview);
        progressBar = (ProgressBar) findViewById(R.id.progressbar);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED);
            } else {
                registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
            }
        } catch (Exception e) {
            // fallback
        }

        configureWebView();

        // Download handling
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                String guessedName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                startDownloadAndInstall(url, guessedName);
            }
        });

        webView.loadUrl(STORE_URL);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        String customUA = settings.getUserAgentString() + " MOMOStoreApp/2.0.0";
        settings.setUserAgentString(customUA);

        // Native Android Bridge for MOMO store
        webView.addJavascriptInterface(new MOMOStoreBridge(this), "MOMOBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadUrl(OFFLINE_URL);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });
    }

    private boolean checkInstallPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!getPackageManager().canRequestPackageInstalls()) {
                try {
                    Intent permIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    permIntent.setData(Uri.parse("package:" + getPackageName()));
                    permIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(permIntent);
                    Toast.makeText(this, "يرجى تفعيل صلاحية تثبيت التطبيقات لمتجر MOMO store", Toast.LENGTH_LONG).show();
                    return false;
                } catch (Exception e) {
                    return true;
                }
            }
        }
        return true;
    }

    public void startDownloadAndInstall(String url, String fileName) {
        try {
            checkInstallPermission();

            if (fileName == null || fileName.isEmpty() || fileName.endsWith(".bin")) {
                fileName = "app-download.apk";
            }
            if (!fileName.endsWith(".apk")) {
                fileName += ".apk";
            }

            File destDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File destFile = new File(destDir, fileName);
            if (destFile.exists()) {
                destFile.delete();
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType("application/vnd.android.package-archive");
            request.setDescription("جارٍ تنزيل وتثبيت التطبيق من MOMO store...");
            request.setTitle(fileName);
            request.allowScanningByMediaScanner();
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                long downloadId = dm.enqueue(request);
                downloadFileMap.put(downloadId, fileName);
                Toast.makeText(this, "بدأ تنزيل " + fileName + " وسيبدأ التثبيت تلقائياً عند الاكتمال", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "خطأ في بدء التحميل: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void triggerInstallForDownload(long downloadId, String fileName) {
        try {
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            Uri apkUri = null;
            if (dm != null) {
                apkUri = dm.getUriForDownloadedFile(downloadId);
            }

            if (apkUri == null && fileName != null) {
                File apkFile = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), fileName);
                if (apkFile.exists()) {
                    apkUri = Uri.parse("content://" + MomoFileProvider.AUTHORITY + apkFile.getAbsolutePath());
                }
            }

            if (apkUri != null) {
                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(installIntent);
                Toast.makeText(this, "جارٍ فتح مثبت الحزم لتثبيت/تحديث التطبيق...", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "تم التنزيل بنجاح. يرجى فتح الملف من شريط الإشعارات للتثبيت.", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "فشل فتح المثبت: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    public class MOMOStoreBridge {
        private Context mContext;

        public MOMOStoreBridge(Context context) {
            this.mContext = context;
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public String getDeviceABI() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                if (Build.SUPPORTED_ABIS != null && Build.SUPPORTED_ABIS.length > 0) {
                    return Build.SUPPORTED_ABIS[0];
                }
            }
            return Build.CPU_ABI;
        }

        @JavascriptInterface
        public boolean isAppInstalled(String packageName) {
            try {
                mContext.getPackageManager().getPackageInfo(packageName, 0);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public int getInstalledVersionCode(String packageName) {
            try {
                PackageInfo pInfo = mContext.getPackageManager().getPackageInfo(packageName, 0);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    return (int) pInfo.getLongVersionCode();
                } else {
                    return pInfo.versionCode;
                }
            } catch (Exception e) {
                return -1;
            }
        }

        @JavascriptInterface
        public String getInstalledVersionName(String packageName) {
            try {
                PackageInfo pInfo = mContext.getPackageManager().getPackageInfo(packageName, 0);
                return pInfo.versionName != null ? pInfo.versionName : "";
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void triggerInstall(final String url, final String fileName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    startDownloadAndInstall(url, fileName);
                }
            });
        }

        @JavascriptInterface
        public void triggerUpdate(final String url, final String fileName, final String packageName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(mContext, "جارٍ تنزيل التحديث وتثبيته مباشرة...", Toast.LENGTH_SHORT).show();
                    startDownloadAndInstall(url, fileName);
                }
            });
        }

        @JavascriptInterface
        public void openApp(final String packageName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent launchIntent = mContext.getPackageManager().getLaunchIntentForPackage(packageName);
                        if (launchIntent != null) {
                            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            mContext.startActivity(launchIntent);
                        } else {
                            Toast.makeText(mContext, "تعذر تشغيل التطبيق تلقائياً", Toast.LENGTH_SHORT).show();
                        }
                    } catch (Exception e) {
                        Toast.makeText(mContext, "خطأ في تشغيل التطبيق: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void uninstallApp(final String packageName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Intent.ACTION_UNINSTALL_PACKAGE);
                        intent.setData(Uri.parse("package:" + packageName));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        mContext.startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(mContext, "خطأ في إلغاء التثبيت", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void promptInstallPermission() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    checkInstallPermission();
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(downloadReceiver);
        } catch (Exception e) {
            // ignore
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
