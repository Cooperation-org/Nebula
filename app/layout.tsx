import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProviderWrapper } from '@/lib/theme/ThemeProviderWrapper'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: {
    default: 'Cooperation Toolkit - Nebula',
    template: '%s | Cooperation Toolkit'
  },
  description: 'Enable any team to share ownership and governance equitably through earned contribution. Track tasks, COOK, peer reviews, and governance updates.',
  keywords: [
    'cooperation toolkit',
    'equitable ownership',
    'governance',
    'COOK',
    'contribution units',
    'peer review',
    'task tracking',
    'team collaboration',
    'earned contribution',
    'transparent governance'
  ],
  authors: [{ name: 'Cooperation Toolkit Team' }],
  creator: 'Cooperation Toolkit',
  publisher: 'Cooperation Toolkit',
  metadataBase: new URL('https://linkedtrust-nebula.vercel.app'),
  alternates: {
    canonical: '/'
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://linkedtrust-nebula.vercel.app',
    siteName: 'Cooperation Toolkit - Nebula',
    title: 'Cooperation Toolkit - Nebula',
    description: 'Enable any team to share ownership and governance equitably through earned contribution',
    images: [
      {
        url: '/og-image.gif',
        width: 300,
        height: 300,
        type: 'image/gif',
        secureUrl: 'https://linkedtrust-nebula.vercel.app/og-image.gif',
        alt: 'Cooperation Toolkit - Nebula Logo'
      }
    ]
  },
  twitter: {
    card: 'summary',
    title: 'Cooperation Toolkit - Nebula',
    description: 'Enable any team to share ownership and governance equitably through earned contribution',
    images: ['/og-image.gif'],
    creator: '@cooperationtoolkit'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
      { url: '/logo.png', type: 'image/png', sizes: '32x32' },
      { url: '/logo.png', type: 'image/png', sizes: '16x16' }
    ],
    apple: [
      { url: '/logo.png', type: 'image/png' }
    ],
    shortcut: '/logo.png'
  },
  category: 'technology',
  classification: 'Business Software',
  other: {
    'og:image:secure_url': 'https://linkedtrust-nebula.vercel.app/og-image.gif',
    'og:image:type': 'image/gif',
    'og:image:width': '300',
    'og:image:height': '300'
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
      </body>
    </html>
  )
}
