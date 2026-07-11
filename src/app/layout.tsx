import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyFlow — Stay in flow.",
  description: "Your AI-powered student productivity companion.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
