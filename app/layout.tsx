import './globals.css'
import SessionWrapper from './components/SessionWrapper'
import GlobalToaster from './components/GlobalToaster'
import { ThemeProvider } from './components/ThemeProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={true}
          disableTransitionOnChange={false}
        >
          <SessionWrapper>
            {children}
            <GlobalToaster />
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
