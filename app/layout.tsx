import './globals.css'
import SessionWrapper from './components/SessionWrapper'
import { ThemeProvider } from './components/ThemeProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
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
      </body>
    </html>
  )
}
