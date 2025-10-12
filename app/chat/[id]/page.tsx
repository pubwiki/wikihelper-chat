"use client";

import WrapLoginChat from "@/components/wrap-login-chat";
import { useMCP } from "@/lib/context/mcp-context";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect } from "react";

export default function ChatPage() {
  const params = useParams();
  const chatId = params?.id as string;
  const queryClient = useQueryClient();
  const {userStatus} = useMCP();

  // Prefetch chat data
  useEffect(() => {
    async function prefetchChat() {
      if (!chatId || !userStatus) return;

      // Check if data already exists in cache
      const existingData = queryClient.getQueryData(["chat", chatId, userStatus.username]);
      if (existingData) return;

      // Prefetch the data
      await queryClient.prefetchQuery({
        queryKey: ["chat", chatId, userStatus.username] as const,
        queryFn: async () => {
          const response = await fetch(`/api/chats/${chatId}`, {
            headers: {
              "x-user-id": userStatus.username,
            },
          });

          if (!response.ok) {
            // For 404, return empty chat data instead of throwing
            if (response.status === 404) {
              return {
                id: chatId,
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            }
            throw new Error("Failed to load chat");
          }

          return response.json();
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
      });
    }

    prefetchChat();
  }, [chatId, userStatus, queryClient]);

  return <WrapLoginChat />;
}
