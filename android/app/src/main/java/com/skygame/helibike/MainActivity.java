package com.skygame.helibike;

import android.net.http.SslError;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private boolean hasFallenBack = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
                @Override
                public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                    if (error.getUrl() != null && (error.getUrl().contains("192.168.1.65") || error.getUrl().contains("localhost"))) {
                        handler.proceed();
                    } else {
                        super.onReceivedSslError(view, handler, error);
                    }
                }

                @Override
                public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                    if (!hasFallenBack && failingUrl != null && failingUrl.contains("192.168.1.65")) {
                        hasFallenBack = true;
                        view.post(() -> {
                            if (getBridge() != null) {
                                view.loadUrl(getBridge().getLocalUrl());
                            }
                        });
                    } else {
                        super.onReceivedError(view, errorCode, description, failingUrl);
                    }
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    if (!hasFallenBack && request.isForMainFrame()) {
                        String url = request.getUrl().toString();
                        if (url.contains("192.168.1.65")) {
                            hasFallenBack = true;
                            view.post(() -> {
                                if (getBridge() != null) {
                                    view.loadUrl(getBridge().getLocalUrl());
                                }
                            });
                            return;
                        }
                    }
                    super.onReceivedError(view, request, error);
                }
            });

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    request.grant(request.getResources());
                }
            });
        }
    }
}
