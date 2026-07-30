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
    title: "CBody — DOM-shaped authoring, canvas-native rendering",
    description:
      "An experimental ECS framework that compiles familiar HTML, CSS, JavaScript, and reactive bindings into one canvas.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "CBody — Write the web. Render the canvas.",
      description:
        "DOM-shaped authoring, reactive bindings, ECS internals, and canvas-native output.",
      images: [{
        url: "/og-cbody.png",
        width: 1734,
        height: 910,
        alt: "CBody turns familiar web markup into ECS components and one canvas",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "CBody — Write the web. Render the canvas.",
      description:
        "An experimental ECS runtime for canvas-rendered interfaces.",
      images: ["/og-cbody.png"],
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
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
