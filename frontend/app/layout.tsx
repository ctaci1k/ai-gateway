// frontend/app/layout.tsx

import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

import { AdminViewProvider } from "@/store/AdminViewContext";
import { AuthProvider } from "@/store/AuthContext";
import { ChatModeProvider } from "@/store/ChatModeContext";
import { ChatsProvider } from "@/store/ChatsContext";
import { ComingSoonProvider } from "@/store/ComingSoonContext";
import { ComposerProvider } from "@/store/ComposerContext";
import { KeysProvider } from "@/store/KeysContext";
import { LanguageProvider } from "@/store/LanguageContext";
import { RagProvider } from "@/store/RagContext";
import { ReportsProvider } from "@/store/ReportsContext";
import { SettingsProvider } from "@/store/SettingsContext";
import { SidebarProvider } from "@/store/SidebarContext";
import { ThemeProvider } from "@/store/ThemeContext";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Gateway — Multi-Model Response System",
  description:
    "One prompt, several AI models in parallel, an AI judge picks the best answer, personalized to you.",
};

// Explicit mobile viewport (PH23/E3): correct scaling on phones, zoom allowed.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${jakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-bg text-fg flex min-h-full flex-col">
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <KeysProvider>
                <AdminViewProvider>
                  <SettingsProvider>
                    <ReportsProvider>
                      <ComingSoonProvider>
                        <ChatsProvider>
                          <RagProvider>
                            <ChatModeProvider>
                              <ComposerProvider>
                                <SidebarProvider>{children}</SidebarProvider>
                              </ComposerProvider>
                            </ChatModeProvider>
                          </RagProvider>
                        </ChatsProvider>
                      </ComingSoonProvider>
                    </ReportsProvider>
                  </SettingsProvider>
                </AdminViewProvider>
              </KeysProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
