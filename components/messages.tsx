import type { UIMessage as TMessage } from "ai";
import { Message } from "./message";
import { useScrollToBottom } from "@/lib/hooks/use-scroll-to-bottom";
import { Skeleton } from "./ui/skeleton";

export const Messages = ({
  messages,
  isLoading,
  status,
  showRefCallback,
}: {
  messages: TMessage[];
  isLoading: boolean;
  status: "error" | "submitted" | "streaming" | "ready";
  showRefCallback: ((args: { title: string; source: string, server: string, contentModel: string }) => void) | undefined;
}) => {
  const [containerRef, endRef] = useScrollToBottom();
  console.log("Rendering Messages with:", { messages, isLoading, status });
  return (
    <div className="h-full overflow-y-auto no-scrollbar" ref={containerRef}>
      <div className="max-w-lg sm:max-w-3xl mx-auto py-4">
        {messages.map((m, i) => (
          <Message
            key={i}
            isLatestMessage={i === messages.length - 1}
            isLoading={isLoading}
            message={m}
            status={status}
            showRefCallback={showRefCallback}
          />
        ))}
        {isLoading &&
          status === "streaming" &&
          messages.length > 0 &&
          messages[messages.length - 1].parts.length > 0 &&
          messages[messages.length - 1].parts.at(-1)!.type == "step-start" && (
            <>
              <Skeleton className="h-4 w-full opacity-40" />
            </>
          )}
        <div className="h-1" ref={endRef} />
      </div>
    </div>
  );
};
