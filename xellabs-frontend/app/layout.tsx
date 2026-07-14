import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ChunkErrorReloader from "./_components/ChunkErrorReloader";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "XelLabs LIMS",
  description: "Laboratory Information Management System — HIPAA-compliant",
  icons: {
    icon: "/xellabs-helix.png",
    shortcut: "/xellabs-helix.png",
    apple: "/xellabs-helix.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ChunkErrorReloader />
        {children}
      </body>
    </html>
  );
}
