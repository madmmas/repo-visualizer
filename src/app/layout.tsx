import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { parseTheme, themeCookie } from "@/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cartograph",
  description: "A dependency map of a repository, drawn from its imports.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = parseTheme((await cookies()).get(themeCookie)?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-background font-sans text-sm text-foreground">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "var(--accent)",
              colorPrimaryForeground: "#ffffff",
              colorBackground: "var(--surface)",
              colorForeground: "var(--foreground)",
              colorMuted: "var(--background)",
              colorMutedForeground: "var(--muted)",
              colorInput: "var(--background)",
              colorInputForeground: "var(--foreground)",
              colorNeutral: "var(--foreground)",
              colorBorder: "var(--border)",
              colorShadow: "transparent",
              borderRadius: "0px",
              fontFamily:
                "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
              fontFamilyMono: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: "0.8125rem",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
