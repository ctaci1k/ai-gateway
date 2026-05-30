// frontend/components/chat/MessageBubble.tsx

"use client";

import { IconSparkle, IconUser } from "@/components/icons/Icons";

interface MessageBubbleProps {
  role?: "user" | "assistant";
  content?: string;
}

export default function MessageBubble({ role = "assistant", content = "" }: MessageBubbleProps) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="msg msg-user">
        <div className="bubble bubble-user">{content}</div>
        <div className="u-av">
          <IconUser size={15} />
        </div>
      </div>
    );
  }

  return (
    <div className="msg msg-ai">
      <div className="ai-av">
        <IconSparkle size={17} />
      </div>
      <div className="bubble bubble-ai">{content}</div>
    </div>
  );
}
