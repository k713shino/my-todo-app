import './globals.css'
import SessionWrapper from './components/SessionWrapper'
import GlobalToaster from './components/GlobalToaster'
import { ThemeProvider } from './components/ThemeProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased safe-bottom">
        {/* 既定タイムゾーンの初期化（未設定時は Asia/Tokyo） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { if (!localStorage.getItem('time:tz')) localStorage.setItem('time:tz', 'Asia/Tokyo') } catch {} })();`
          }}
        />
        {/* Service Worker 登録とSW→ページのメッセージ受信（通知クリック対応） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
    navigator.serviceWorker.addEventListener('message', (event) => {
      try {
        if (!event || !event.data) return;
        if (event.data.type === 'focus-todo' && event.data.todoId) {
          const id = String(event.data.todoId);
          const url = '/dashboard?focus=' + encodeURIComponent(id);
          // 現在地がダッシュボードならクエリだけ更新、それ以外は遷移
          if (location.pathname.startsWith('/dashboard')) {
            const sp = new URLSearchParams(location.search);
            sp.set('focus', id);
            history.replaceState(null, '', location.pathname + '?' + sp.toString());
            // 軽いスクロール誘発（TodoList側の監視でハイライト実施）
            try { window.dispatchEvent(new Event('popstate')); } catch {}
          } else {
            location.href = url;
          }
        }
      } catch {}
    });
  }
})();`,
          }}
        />
        {/* Toaster は最上位に配置して即マウント（重い子コンポーネントより前） */}
        <GlobalToaster />

        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={true}
          disableTransitionOnChange={false}
        >
          <SessionWrapper>
            {children}
          </SessionWrapper>
        </ThemeProvider>
        {/* デプロイ直後に旧ハッシュのチャンクを参照して404になる場合の自己回復 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  const FLAG = 'app:reloaded-after-chunk-error';
  const markReloaded = () => { try { sessionStorage.setItem(FLAG, '1') } catch {}
  };
  const wasReloaded = () => { try { return sessionStorage.getItem(FLAG) === '1' } catch { return false } };
  const clearReloaded = () => { try { sessionStorage.removeItem(FLAG) } catch {} };

  function shouldReload(msg) {
    if (!msg) return false;
    return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|ERR_ABORTED|net::ERR_ABORTED/i.test(String(msg));
  }

  function reloadOnce() {
    if (wasReloaded()) return; // ループ防止
    markReloaded();
    try { console.warn('[self-heal] Detected stale chunks. Reloading once...') } catch {}
    location.reload();
  }

  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    const msg = r && (r.message || String(r));
    if (shouldReload(msg)) reloadOnce();
  });

  window.addEventListener('error', (e) => {
    const msg = (e && e.message) || (e && e.error && e.error.message) || '';
    if (shouldReload(msg)) reloadOnce();
  }, true);

  // 正常ロード時はフラグをクリア
  window.addEventListener('load', clearReloaded);
})();`,
          }}
        />
      </body>
    </html>
  )
}
