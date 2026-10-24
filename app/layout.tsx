import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'CogniBase',
  description: 'AI Study & Exam Prep. Your entire semester, synthesized.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: 'resizes-content',
};

import { cookies } from 'next/headers';
import { UserProvider } from '@/lib/hooks/useUserContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemedToaster } from '@/components/ThemedToaster';
import { THEMES, THEME_COOKIE, isAppTheme } from '@/lib/theme-cookie';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The saved theme is mirrored into a cookie, so the first paint matches it.
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isAppTheme(saved) ? saved : 'charcoal';

  return (
    <html lang="en" className={theme} style={{ colorScheme: theme === 'ivory' ? 'light' : 'dark' }} suppressHydrationWarning>
      <body className={`${instrumentSans.variable} ${jetbrainsMono.variable} antialiased min-h-dvh`}>
        <ThemeProvider attribute="class" defaultTheme={theme} themes={[...THEMES]}>
          <UserProvider>
            {children}
            <ThemedToaster />
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
