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

import { Toaster } from 'sonner';
import { UserProvider } from '@/lib/hooks/useUserContext';
import { ThemeProvider } from '@/components/ThemeProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${instrumentSans.variable} ${jetbrainsMono.variable} antialiased min-h-dvh`}>
        <ThemeProvider attribute="class" defaultTheme="charcoal" themes={['charcoal', 'dark', 'ivory']}>
          <UserProvider>
            {children}
            <Toaster position="bottom-right" theme="dark" richColors closeButton />
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
