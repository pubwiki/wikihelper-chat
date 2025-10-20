"use client";

import { defaultModel, type modelID } from "@/ai/providers";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Textarea } from "./textarea";
import { ProjectOverview } from "./project-overview";
import { Messages } from "./messages";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { convertToUIMessages } from "@/lib/chat-store";
import { type Message as DBMessage } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import {
  CreateWikiArgs,
  CreateWikiSSEProgressMessage,
  CreateWikiSSEStatusMessage,
  EditWikiPageArgs,
  useMCP,
  UserOptionBtn,
} from "@/lib/context/mcp-context";
import { GlassButton } from "./glass-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@radix-ui/react-label";
import { InfoTable } from "./info-table";
import { Button } from "./ui/button";
import { extendMarkHTML, extendWikiHTML } from "@/lib/context/html-util";
import { SITE_SUFFIX, SIGN_UP_URL } from "@/lib/constants";
import { parseWikiUrl } from "@/lib/common/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { clientUIResultManager } from "@/lib/client-ui-result";
import { useFrontendChat, type UIMessage } from "@/lib/hooks/use-frontend-chat";

// Type for chat data from DB
interface ChatData {
  id: string;
  messages: DBMessage[];
  createdAt: string;
  updatedAt: string;
}

// 生成文件内容的 sha256 哈希作为文件名
async function generateFileName(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? `${hashHex}.${ext}` : hashHex;
}

export async function uploadImage(file: File) {
  // 先生成基于内容的哈希文件名
  const key = await generateFileName(file);

  // 第一步：向后端要一个 signed PUT URL
  const res = await fetch("/api/upload/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: key, fileType: file.type }),
  });

  const { uploadUrl, publicUrl } = await res.json();

  // 第二步：前端直传文件
  await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  // 第三步：通知后端把对象 ACL 设为 public-read
  const aclRes = await fetch("/api/upload/make-public", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });

  const { publicUrl: finalUrl } = await aclRes.json();

  return finalUrl;
}

export default function Chat() {
  const router = useRouter();
  const params = useParams();
  const chatId = params?.id as string | undefined;
  const queryClient = useQueryClient();

  const [selectedModel, setSelectedModel] = useLocalStorage<modelID>(
    "selectedModel",
    defaultModel
  );
  const [generatedChatId, setGeneratedChatId] = useState<string>("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [refMark, setRefMark] = useState<string | null>(null);

  const [showRefMark, setShowRefMark] = useState<{
    server: string;
    title: string;
    source: string;
    contentModel: string;
    html: string | null;
  } | null>(null);

  // Helper function to create a UIMessage
  const createUserMessage = (content: string): UIMessage => ({
    id: nanoid(),
    role: 'user',
    content,
    parts: [{ type: 'text', text: content }],
  });

  // Get MCP server data from context
  const {
    getActiveServersForApi,
    userOptions,
    setUserOptions,
    createWikiStatus,
    setCreateWikiStatus,
    pendingEditPageToolCall,
    setPendingEditPageToolCall,
    pendingEditPageHTML,
    setPendingEditPageHTML,
    userStatus,
    fetchWithAuth,
  } = useMCP();

  // Generate a chat ID if needed
  useEffect(() => {
    if (!chatId) {
      setGeneratedChatId(nanoid());
    }
  }, [chatId]);

  // Use client-side UI result manager instead of backend API
  const setUIResult = (
    result: Record<string, string>,
    taskName: string
  ) => {
    clientUIResultManager.setResult(chatId || generatedChatId, result, taskName);
  };

  const pendingChangePageAnnotations = useRef<
    { title: string; text: string }[]
  >([]);

  const pendingSendRefMark = useRef<{
    title: string;
    text: string;
    sectionId: string;
  }>({ title: "", text: "", sectionId: "" });

  const showReference = (args: {
    title: string;
    source: string;
    server: string;
    contentModel: string;
  }) => {
    console.log("Show reference called with:", args);
    setShowRefMark({
      title: args.title,
      source: args.source,
      server: args.server,
      contentModel: args.contentModel,
      html: null,
    });
    pendingSendRefMark.current.title = args.title;
    fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wikitext: args.source,
        server: parseWikiUrl(args.server),
        contentModel: args.contentModel || "wikitext",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setShowRefMark({
          title: args.title,
          source: args.source,
          server: args.server,
          contentModel: args.contentModel,
          html: extendMarkHTML(data.html),
        });
      });
  };

  // Use React Query to fetch chat history - now from IndexedDB
  const {
    data: chatData,
    isLoading: isLoadingChat,
    error,
  } = useQuery({
    queryKey: ["chat", chatId, userStatus?.username] as const,
    queryFn: async ({ queryKey }) => {
      const [_, chatId, userId] = queryKey;
      if (!chatId || !userId) return null;

      // Directly query IndexedDB via PGlite
      const { getChatById } = await import('@/lib/chat-store');
      const chat = await getChatById(chatId, userId);

      if (!chat) {
        // Return empty chat data if not found
        return {
          id: chatId,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        ...chat,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
      } as ChatData;
    },
    enabled: !!chatId && !!userStatus?.username,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Handle query errors
  useEffect(() => {
    if (error) {
      console.error("Error loading chat history:", error);
      toast.error("Failed to load chat history");
    }
  }, [error]);

  // Prepare initial messages from query data
  const initialMessages = useMemo(() => {
    if (!chatData || !chatData.messages || chatData.messages.length === 0) {
      return [];
    }

    // Convert DB messages to UI format
    return convertToUIMessages(chatData.messages) as UIMessage[];
  }, [chatData]);

  const servers = getActiveServersForApi();

  const streamCreateWiki = async (args: CreateWikiArgs) => {
    setCreateWikiStatus({
      ...createWikiStatus!,
      resultStatus: "in-progress",
    });
    const res = await fetchWithAuth("/api/task/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...args,
        reqcookie: (userStatus?.pubwikiCookie ?? []).join("; "),
      }),
    });
    const { taskId, error } = await res.json();
    const wikiUrl = `https://${args.slug}${SITE_SUFFIX}`;
    if (!taskId) {
      toast.error(
        `Failed to create wiki on: ${wikiUrl}, no task ID returned: ${error}`
      );
      append(createUserMessage(
        `[PubwikiSystem] Failed to create wiki on: ${wikiUrl}, message: ${error}`
      ));
      setCreateWikiStatus(undefined);
      return;
    }
    const evtSource = new EventSource(
      `/api/task/${taskId}/status?reqcookie=${encodeURIComponent(
        (userStatus?.pubwikiCookie ?? []).join("; ")
      )}`
    );
    evtSource.addEventListener("status", (data) => {
      const e = JSON.parse(data.data) as CreateWikiSSEStatusMessage;
      if (e.status != "succeeded" && e.status != "failed") {
        return;
      }
      append(createUserMessage(
        `[PubwikiSystem] Create wiki finished on: ${wikiUrl}, message: ${JSON.stringify(e)}`
      ));
      evtSource.close();
      setCreateWikiStatus(undefined);
    });
    evtSource.addEventListener("progress", (data) => {
      const e = JSON.parse(data.data) as CreateWikiSSEProgressMessage;
      setCreateWikiStatus({
        ...createWikiStatus!,
        status: e.status,
        message: e.message,
        phase: e.phase,
        resultStatus: "in-progress",
      });
    });
  };

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    status,
    stop,
    setMessages,
    isNewChat: isFrontendNewChat,
    chatId: frontendChatId,
  } = useFrontendChat({
    id: chatId,
    initialMessages,
    mcpServers: servers,
    appendHeaders: {
      reqcookie: (userStatus?.pubwikiCookie ?? []).join("; "),
    },
    userId: userStatus?.username || "",
    onFinish: () => {
      // Invalidate the chats query to refresh the sidebar
      if (userStatus?.username) {
        queryClient.invalidateQueries({
          queryKey: ["chats", userStatus.username],
        });
      }
    },
    onToolCall: ({ toolName, args }: { toolName: string; args: any }) => {
      if (toolName === "ui-show-options") {
        const options = (args as any)["options"] as UserOptionBtn[];
        setUserOptions(options);
      } else if (toolName === "edit-page") {
        const editArgs = args as EditWikiPageArgs;
        setPendingEditPageToolCall({
          type: editArgs.editType,
          args: editArgs,
        });
        fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wikitext: editArgs.content,
            server: parseWikiUrl(editArgs.server),
            contentModel: editArgs.contentModel || "wikitext",
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            setPendingEditPageHTML(extendWikiHTML(data.html));
            console.log("Parsed HTML:", data.html);
          })
          .catch(() =>
            setPendingEditPageHTML("<p>Error rendering preview</p>")
          );
      } else if (toolName === "create-new-wiki-site") {
        const createArgs = args as CreateWikiArgs;
        setCreateWikiStatus({
          args: createArgs,
          resultStatus: "waiting-confirmation",
        });
      }
    },
    onError: (error: Error) => {
      console.log(error);
      toast.error(
        error.message.length > 0
          ? "Error: " + error.message
          : "An error occurred, please try again later.",
        { position: "top-center", richColors: true }
      );
    },
  });

  let targetWikiUrl = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    for (const p of msg.parts) {
      if (
        p.type === "tool-invocation" &&
        p.toolInvocation?.toolName === "set-target-wiki"
      ) {
        targetWikiUrl = p.toolInvocation.args.url ?? null;
        break;
      }
    }
  }
  targetWikiUrl = "123"
  // Custom submit handler
  const handleFormSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      let img_url = null as string | null;
      if (imageFile) {
        try {
          setUploading(true);
          img_url = await uploadImage(imageFile);
          console.log("Image uploaded to:", img_url);
        } catch (err) {
          toast.error(`Image upload failed: ${err}, please try again.`);
          return;
        }
        setImageFile(null);
        setRefMark(null);
        setUploading(false);
      }

      if (img_url) {
        setMessages(
          messages.concat([
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [
                {
                  type: "text",
                  text: `[PubwikiSystem] User uploaded an image: [image](${img_url}).
                 Do NOT guess its content, should ask the user which wiki page to add it to.
                 Note: when user answered, then use 'upload-image' tool to upload the image to the wiki site, and use 'edit-page' tool to add the image to the page.
                 Thumbnail preview: ![thumbnail](${img_url})  `,
                },
              ],
              content: ``,
            },
          ])
        );
      }

      if (pendingSendRefMark.current && refMark) {
        setMessages(
          messages.concat([
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [
                {
                  type: "text",
                  text: `[PubwikiSystem] User added a reference mark for Page [${pendingSendRefMark.current.title}] Section [${pendingSendRefMark.current.sectionId}] : ${refMark}.`,
                },
              ],
              content: ``,
            },
          ])
        );
      }

      if (!chatId && generatedChatId && input.trim()) {
        // If this is a new conversation, redirect to the chat page with the generated ID
        const effectiveChatId = generatedChatId;
        // Submit the form
        handleSubmit(e, {
          body: {
            //appendParts
          },
        });
        // Redirect to the chat page with the generated ID
        router.push(`/chat/${effectiveChatId}`);
      } else {
        setUserOptions([]);
        // Normal submission for existing chats
        handleSubmit(e, {
          body: {
            //appendParts
          },
        });
      }
    },
    [chatId, generatedChatId, input, handleSubmit, router]
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "ANNOTATION_ADDED") {
        pendingChangePageAnnotations.current.push({
          text: event.data.text,
          title: event.data.sectionTitle,
        });
      }
      if (event.data?.type === "RERMARK_ADD") {
        pendingSendRefMark.current.text = event.data.text;
        pendingSendRefMark.current.sectionId = event.data.sectionId;
        setRefMark(event.data.text);
        setShowRefMark(null);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const onUserOptionClick = (o: UserOptionBtn) => {
    if (isLoading) {
      return;
    }
    append(createUserMessage(
      `[PubwikiSystem] Click Action Button: ${o.title}, action: ${o.action}`
    ));
    setUserOptions([]);
  };

  const isLoading =
    status === "streaming" || status === "submitted" || isLoadingChat;

  return (
    <div className="h-dvh flex flex-col justify-center w-full max-w-[430px] sm:max-w-3xl mx-auto px-4 sm:px-6 py-3">
      {messages.length === 0 && !isLoadingChat ? (
        <div className="max-w-xl mx-auto w-full">
          <ProjectOverview />
          <form onSubmit={handleFormSubmit} className="mt-4 w-full mx-auto">
            <Textarea
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              handleInputChange={handleInputChange}
              input={input}
              isLoading={isLoading}
              status={status}
              stop={stop}
              imageFile={imageFile}
              setImageFile={setImageFile}
              isUploading={uploading}
              refMark={refMark}
              setRefMark={setRefMark}
            />
          </form>
        </div>
      ) : (
        <>
          {targetWikiUrl && false && (
            <div className="w-full flex justify-center sticky top-0 z-10">
              <div className="w-full flex items-center font-bold bg-transparent border-2 border-border/60 shadow-none px-4 h-10 dark:border-input dark:bg-input/50 rounded-md text-sm transition-all">
                <span className=" mr-4">{`Target Wiki: ${targetWikiUrl}`}</span>
                <Button variant="default" size="xs">Change to Public</Button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto min-h-0 pb-2">
            <Messages
              messages={messages}
              isLoading={isLoading}
              status={status}
              showRefCallback={showReference}
            />
          </div>
          {userOptions && userOptions.length > 0 && (
            <div className="h-10 flex gap-2">
              {userOptions.map((o) => (
                <GlassButton
                  key={o.title}
                  label={o.title}
                  tooltip={o.action}
                  onClick={() => onUserOptionClick(o)}
                ></GlassButton>
              ))}
            </div>
          )}
          <form onSubmit={handleFormSubmit} className="mt-2 w-full mx-auto">
            <Textarea
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              handleInputChange={handleInputChange}
              input={input}
              isLoading={isLoading}
              status={status}
              stop={stop}
              imageFile={imageFile}
              setImageFile={setImageFile}
              isUploading={uploading}
              refMark={refMark}
              setRefMark={setRefMark}
            />
          </form>
        </>
      )}
      {createWikiStatus && (
        <Dialog open={true}>
          <DialogContent
            className="sm:max-w-[500px]"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Creating Your Wiki World</DialogTitle>
              <DialogDescription>
                Please review the details below before continuing.
                <br />
                Setting up your wiki may take a few minutes.
              </DialogDescription>
            </DialogHeader>

            <InfoTable
              rows={[
                { label: "Wiki Name", value: createWikiStatus.args.name },
                {
                  label: "Wiki Sub-Website URL",
                  value: [
                    <span key="prefix" className="font-bold">
                      {createWikiStatus.args.slug}
                    </span>,
                    <span key="suffix" className="opacity-55">
                      {SITE_SUFFIX}
                    </span>,
                  ],
                },
                {
                  label: "Wiki Language",
                  value: createWikiStatus.args.language,
                },
              ]}
              className="mt-4"
            />

            <div className="mt-4 flex flex-col gap-8">
              <span className="text-md text-foreground font-bold">
                Creating status: {createWikiStatus.status} - phase:{" "}
                {createWikiStatus.phase}
              </span>
              {/* <Progress value={12}></Progress> */}
            </div>
            {createWikiStatus.resultStatus === "waiting-confirmation" && (
              <DialogFooter className="mt-4">
                <Button
                  onClick={() => {
                    streamCreateWiki(createWikiStatus.args);
                  }}
                >
                  Confirm
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    append(createUserMessage(
                      `[PubwikiSystem] User cancelled wiki creation, you can ask why and what to change if needed.`
                    ));
                    setCreateWikiStatus(undefined);
                  }}
                >
                  Cancel
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!pendingEditPageToolCall}>
        <DialogContent
          className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {pendingEditPageToolCall?.type === "create"
                ? "Create Page"
                : "Update Page"}
            </DialogTitle>
            <DialogDescription>
              Please review the details below before proceeding. You can
              annotate for section, annotation will not be saved but use as
              reference for the AI to regenerate the content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="font-semibold">Page Title</Label>
              <p>{pendingEditPageToolCall?.args.title}</p>
            </div>

            <div>
              <Label className="font-semibold">Comment</Label>
              <p>{pendingEditPageToolCall?.args.comment}</p>
            </div>

            <div>
              <Label className="font-semibold">Preview</Label>
              <iframe
                className="w-full h-[300px] min-h-[40vh] border rounded-md"
                srcDoc={`${pendingEditPageHTML}`}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              onClick={() => {
                if (pendingEditPageToolCall) {
                  setUIResult(
                    {
                      confirm: "false",
                      content:
                        "User rejected the change. And adviced to regenerate. User annotations: " +
                        pendingChangePageAnnotations.current
                          .map((v) => `[Section:${v.title}] ${v.text}`)
                          .join("; "),
                    },
                    "edit-page"
                  );
                  pendingChangePageAnnotations.current = [];
                  setPendingEditPageToolCall(null);
                  setPendingEditPageHTML("Rendering preview...");
                }
              }}
            >
              ReGenerate
            </Button>
            <Button
              onClick={() => {
                if (pendingEditPageToolCall) {
                  setUIResult(
                    {
                      confirm: "true",
                      content: "User confirmed the change.",
                    },
                    "edit-page"
                  );
                  pendingChangePageAnnotations.current = [];
                  setPendingEditPageToolCall(null);
                  setPendingEditPageHTML("Rendering preview...");
                }
              }}
            >
              Confirm
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (pendingEditPageToolCall) {
                  setUIResult(
                    {
                      confirm: "false",
                      content: "User rejected the change.",
                    },
                    "edit-page"
                  );
                  pendingChangePageAnnotations.current = [];
                  setPendingEditPageToolCall(null);
                  setPendingEditPageHTML("Rendering preview...");
                }
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showRefMark}>
        <DialogContent
          className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Mark Reference</DialogTitle>
            <DialogDescription>
              Mark something and use these as reference for the AI to regenerate
              the content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-semibold">Preview</Label>
              <iframe
                className="w-full h-[300px] min-h-[40vh] border rounded-md"
                srcDoc={`${showRefMark?.html ?? "<p>Rendering preview...</p>"}`}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowRefMark(null);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
