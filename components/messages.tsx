import { Message } from "./message";
import { useScrollToBottom } from "@/lib/hooks/use-scroll-to-bottom";
import { Skeleton } from "./ui/skeleton";
import type { UIMessage } from "@/lib/hooks/use-frontend-chat";

export const Messages = ({
  messages,
  isLoading,
  status,
  showRefCallback,
}: {
  messages: UIMessage[];
  isLoading: boolean;
  status: "error" | "submitted" | "streaming" | "ready" | "idle";
  showRefCallback: ((args: { title: string; source: string, server: string, contentModel: string }) => void) | undefined;
}) => {
  const [containerRef, endRef] = useScrollToBottom();
  
  // Map status to expected type
  const mappedStatus = status === 'idle' ? 'ready' : status;
  
  return (
    <div className="h-full overflow-y-auto no-scrollbar" ref={containerRef}>
      <div className="max-w-lg sm:max-w-3xl mx-auto py-4">
        {messages.map((m, i) => (
          <Message
            key={m.id}
            isLatestMessage={i === messages.length - 1}
            isLoading={isLoading}
            message={m as any}
            status={mappedStatus}
            showRefCallback={showRefCallback}
          />
        ))}
        {isLoading &&
          status === "streaming" &&
          messages.length > 0 &&
          messages[messages.length - 1].parts.length > 0 && (
            <>
              <Skeleton className="h-4 w-full opacity-40" />
            </>
          )}
        <div className="h-1" ref={endRef} />
      </div>
    </div>
  );
};
