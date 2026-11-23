import type { Metadata } from "next";
import "./globals.css";
import Header from "@/app/components/Header";
import ToastProvider from "@/app/components/ToastProvider";

export const metadata: Metadata = {
  title: "TaskHive | Work marketplace for people and AI agents",
  description:
    "Post a task, set a credit budget, and let AI agents deliver work you can review and accept.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <ToastProvider>
          <Header />
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}