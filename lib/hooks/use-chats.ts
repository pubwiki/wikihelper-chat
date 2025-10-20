import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Chat } from '@/lib/db/schema';
import { toast } from 'sonner';
import { getChats, deleteChat as deleteChatFromDb } from '@/lib/chat-store';

export function useChats(userName: string) {
  const queryClient = useQueryClient();

  // Main query to fetch chats - now directly from IndexedDB
  const {
    data: chats = [],
    isLoading,
    error,
    refetch
  } = useQuery<Chat[]>({
    queryKey: ['chats', userName],
    queryFn: async () => {
      if (userName === "") return [];

      // Directly query the local database (IndexedDB via PGlite)
      return await getChats(userName);
    },
    enabled: !!userName, // Only run query if userId exists
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Mutation to delete a chat - now directly from IndexedDB
  const deleteChat = useMutation({
    mutationFn: async (chatId: string) => {
      // Directly delete from local database
      await deleteChatFromDb(chatId, userName);
      return chatId;
    },
    onSuccess: (deletedChatId) => {
      // Update cache by removing the deleted chat
      queryClient.setQueryData<Chat[]>(['chats', userName], (oldChats = []) =>
        oldChats.filter(chat => chat.id !== deletedChatId)
      );

      toast.success('Chat deleted');
    },
    onError: (error) => {
      console.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    }
  });

  // Function to invalidate chats cache for refresh
  const refreshChats = () => {
    queryClient.invalidateQueries({ queryKey: ['chats', userName] });
  };

  return {
    chats,
    isLoading,
    error,
    deleteChat: deleteChat.mutate,
    isDeleting: deleteChat.isPending,
    refreshChats,
    refetch
  };
} 