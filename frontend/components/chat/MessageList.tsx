// frontend/components/chat/MessageList.tsx

"use client";

import type { Message } from "@/types/Message";

import MessageBubble from "./MessageBubble";

interface MessageListProps {
  messages?: Message[];
}

export default function MessageList({ messages = [] }: MessageListProps) {
  return (
    <>
      {messages.map((message) => (
        <MessageBubble key={message.id} role={message.role} content={message.content} />
      ))}
    </>
  );
}
