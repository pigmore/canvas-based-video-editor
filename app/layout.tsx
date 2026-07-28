import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const metadataBase = host
    ? new URL(`${protocol}://${host}`)
    : new URL("http://localhost:3000");

  return {
    metadataBase,
    title: "LumaFrame — Canvas motion editor",
    description:
      "Compose images, video and type on a canvas timeline with transform keyframes and easing.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "LumaFrame — Make ideas move",
      description:
        "A precision canvas editor for video, images, type, timeline clips and transform keyframes.",
      images: [{ url: "/og.png", width: 1734, height: 910, alt: "LumaFrame motion editor" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "LumaFrame — Make ideas move",
      description:
        "Compose and animate media with a canvas monitor, timeline, keyframes and easing.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
