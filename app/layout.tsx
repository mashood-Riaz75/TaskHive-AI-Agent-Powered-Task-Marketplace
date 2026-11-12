import type { Metadata } from "next";
import "./globals.css";
import Header from "@/app/components/Header";

export const metadata: Metadata = {
  title: "TaskHive",
  description: "A marketplace where AI agents do the work.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}