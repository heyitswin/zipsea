import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import GlobalAlertProvider from "../components/GlobalAlertProvider";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";
import ClerkProviderWrapper from "./components/ClerkProviderWrapper";
import PostHogProviderWrapper, {
  PostHogPageView,
} from "./providers/PosthogProvider";
import MissiveChat from "./components/MissiveChat";
import { BookingProvider } from "./context/BookingContext";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#5A4BDB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "Zipsea - Find the Best Cruise Deals",
  description:
    "Discover amazing cruise deals and book your perfect vacation with Zipsea. Get maximum onboard credit on every cruise booking.",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL("https://www.zipsea.com"),
  alternates: {
    canonical: "https://www.zipsea.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.zipsea.com",
    siteName: "Zipsea",
    title: "Zipsea - Find the Best Cruise Deals",
    description:
      "Discover amazing cruise deals and book your perfect vacation with Zipsea. Compare prices, find last-minute deals, and sail away for less!",
    images: [
      {
        url: "/images/opengraph.png",
        width: 1200,
        height: 630,
        alt: "Zipsea - Your Gateway to Amazing Cruise Deals",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zipsea - Find the Best Cruise Deals",
    description:
      "Discover amazing cruise deals and book your perfect vacation with Zipsea. Compare prices, find last-minute deals, and sail away for less!",
    images: ["/images/opengraph.png"],
    creator: "@zipsea",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-57x57.png", sizes: "57x57", type: "image/png" },
      { url: "/apple-touch-icon-60x60.png", sizes: "60x60", type: "image/png" },
      { url: "/apple-touch-icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/apple-touch-icon-76x76.png", sizes: "76x76", type: "image/png" },
      {
        url: "/apple-touch-icon-114x114.png",
        sizes: "114x114",
        type: "image/png",
      },
      {
        url: "/apple-touch-icon-120x120.png",
        sizes: "120x120",
        type: "image/png",
      },
      {
        url: "/apple-touch-icon-144x144.png",
        sizes: "144x144",
        type: "image/png",
      },
      {
        url: "/apple-touch-icon-152x152.png",
        sizes: "152x152",
        type: "image/png",
      },
      {
        url: "/apple-touch-icon-167x167.png",
        sizes: "167x167",
        type: "image/png",
      },
      {
        url: "/apple-touch-icon-180x180.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        url: "/apple-touch-icon-1024x1024.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/apple-touch-icon-precomposed.png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zipsea",
    startupImage: [
      "/apple-touch-startup-image-640x1136.png",
      "/apple-touch-startup-image-750x1334.png",
      "/apple-touch-startup-image-828x1792.png",
      "/apple-touch-startup-image-1125x2436.png",
      "/apple-touch-startup-image-1170x2532.png",
      "/apple-touch-startup-image-1242x2208.png",
      "/apple-touch-startup-image-1242x2688.png",
      "/apple-touch-startup-image-1284x2778.png",
      "/apple-touch-startup-image-1290x2796.png",
      "/apple-touch-startup-image-1536x2048.png",
      "/apple-touch-startup-image-1668x2224.png",
      "/apple-touch-startup-image-1668x2388.png",
      "/apple-touch-startup-image-2048x2732.png",
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "application-name": "Zipsea",
    "msapplication-TileColor": "#5A4BDB",
    "msapplication-TileImage": "/mstile-144x144.png",
    "msapplication-config": "/browserconfig.xml",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProviderWrapper>
      {/* Google Tag Manager - beforeInteractive loads in head */}
      <Script id="google-tag-manager" strategy="beforeInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-KCLJ76N4');
        `}
      </Script>
      {/* Google tag (gtag.js) - beforeInteractive loads in head */}
      <Script
        async
        src="https://www.googletagmanager.com/gtag/js?id=AW-17578519507"
        strategy="beforeInteractive"
      />
      <Script id="google-analytics" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-17578519507');
        `}
      </Script>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {/* Google Tag Manager (noscript) */}
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-KCLJ76N4"
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
          <PostHogProviderWrapper>
            <Suspense fallback={null}>
              <PostHogPageView />
            </Suspense>
            <GlobalAlertProvider>
              <BookingProvider>
                <Navigation />
                {children}
                <Footer />
                <MissiveChat />
              </BookingProvider>
            </GlobalAlertProvider>
          </PostHogProviderWrapper>
        </body>
      </html>
    </ClerkProviderWrapper>
  );
}
