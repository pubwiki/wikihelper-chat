"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2,
  CheckCircle2,
  TerminalSquare,
  Code,
  ArrowRight,
  Circle,
  SquarePen,
  Cable,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseWikiUrl } from "@/lib/common/utils";

interface ToolInvocationProps {
  toolName: string;
  state: string;
  args: any;
  result: any;
  isLatestMessage: boolean;
  status: string;
  showRefCallback: ((args: { title: string; source: string, server:string, contentModel:string }) => void) | undefined;
}

const RunningToolNameMap: Record<
  string,
  (args: Record<string, string>) => string
> = {
  "edit-page": (args) =>
    `${args.type == "create" ? "Creating" : "Editing"} Wiki Page: ${
      args.title
    }`,
  "get-page": (args) => `Fetching Wiki Page: ${args.title}`,
  "set-target-wiki": (args) => `Setting Target Wiki to: ${args.server}`,
  "list-all-page-titles": (args) => `Listing All Page Titles`,
  "upload-image": (args) => `Uploading Image: ${args.filename}`,
  "load-world": (args) => `Loading Wiki Site: ${args.server}`,
  "create-new-wiki-site": (args) => `Creating New Wiki Site: ${args.slug}`,
};

const ResultToolNameMap: Record<
  string,
  (args: Record<string, string>) => string
> = {
  "edit-page": (args) =>
    `${args.type == "create" ? "Created" : "Edited"} Wiki Page`,
  "get-page": (args) => `Fetched Wiki Page`,
  "set-target-wiki": (args) => `Set Target Wiki to: ${args.server})`,
  "list-all-page-titles": (args) => `Listed All Page Titles`,
  "upload-image": (args) => `Uploaded Image: ${args.filename}`,
  "load-world": (args) => `Loaded Wiki Site: ${args.server}`,
  "create-new-wiki-site": (args) => `Created New Wiki Site: ${args.slug}`,
};

const ShowRefPageFooterNames = ["edit-page", "get-page"];

export function ToolInvocation({
  toolName,
  state,
  args,
  result,
  isLatestMessage,
  status,
  showRefCallback,
}: ToolInvocationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const HiddenToolNames = ["ui-show-options"];
  const getToolDisplayName = () => {
    if (state == "call") {
      if (toolName in RunningToolNameMap) {
        return (
          RunningToolNameMap[toolName](args) ?? `Running MCP tool: ${toolName}`
        );
      }
    } else {
      if (toolName in ResultToolNameMap) {
        return (
          ResultToolNameMap[toolName](args) ??
          `${result.isError ? "[Failed] " : ""} Completed MCP tool: ${toolName}`
        );
      }
    }
    return toolName;
  };


  const getStatusIcon = () => {
    if (state === "call") {
      if (isLatestMessage && status !== "ready") {
        return <Loader2 className="animate-spin h-3.5 w-3.5 text-primary/70" />;
      }
      return (
        <Circle className="h-3.5 w-3.5 fill-muted-foreground/10 text-muted-foreground/70" />
      );
    }
    return <CheckCircle2 size={14} className="text-primary/90" />;
  };

  const getStatusClass = () => {
    if (state === "call") {
      if (isLatestMessage && status !== "ready") {
        return "text-primary";
      }
      return "text-muted-foreground";
    }
    return "text-primary";
  };

  const formatContent = (content: any): string => {
    try {
      if (typeof content === "string") {
        try {
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return content;
        }
      }
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  };

  const showRefPageFooter =
    ShowRefPageFooterNames.includes(toolName) &&
    state === "result" &&
    !result.isError &&
    args.title;
  const url = showRefPageFooter
    ? `${parseWikiUrl(args.server)}wiki/${args.title}`
    : undefined;

  return HiddenToolNames.includes(toolName) ? null : (
    <div
      className={cn(
        "flex flex-col mb-2 rounded-md border border-border/50 overflow-hidden",
        "bg-gradient-to-b from-background to-muted/30 backdrop-blur-sm",
        "transition-all duration-200 hover:border-border/80 group"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors",
          "hover:bg-muted/20"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-center rounded-full w-5 h-5 bg-primary/5 text-primary">
          <TerminalSquare className="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground flex-1">
          <span className="text-foreground font-semibold tracking-tight">
            {getToolDisplayName()}
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
          <span className={cn("font-medium", getStatusClass())}>
            {state === "call"
              ? isLatestMessage && status !== "ready"
                ? "Running"
                : "Waiting"
              : "Completed"}
          </span>
        </div>
        <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
          {getStatusIcon()}
          <div className="bg-muted/30 rounded-full p-0.5 border border-border/30">
            {isExpanded ? (
              <ChevronUpIcon className="h-3 w-3 text-foreground/70" />
            ) : (
              <ChevronDownIcon className="h-3 w-3 text-foreground/70" />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2 px-3 pb-3">
          {!!args && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 pt-1.5">
                <Code className="h-3 w-3" />
                <span className="font-medium">Arguments</span>
              </div>
              <pre
                className={cn(
                  "text-xs font-mono p-2.5 rounded-md overflow-x-auto",
                  "border border-border/40 bg-muted/10"
                )}
              >
                {formatContent(args)}
              </pre>
            </div>
          )}

          {!!result && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium">Result</span>
              </div>
              <pre
                className={cn(
                  "text-xs font-mono p-2.5 rounded-md overflow-x-auto max-h-[300px] overflow-y-auto",
                  "border border-border/40 bg-muted/10"
                )}
              >
                {formatContent(result)}
              </pre>
            </div>
          )}
        </div>
      )}

      {showRefPageFooter && (
        <div className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors text-xs">
          <div className="flex items-center justify-center rounded-full w-5 h-5 text-muted-foreground/70">
            <Cable className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <span className="font-medium"> {args.title}</span>
          </div>
          <div className="px-2 py-1 bg-muted/50 rounded-md border border-border/30 hover:bg-muted/70 transition-colors">
            <a
              onClick={() => {
                if (!showRefCallback) return;
                if (toolName == "edit-page") {
                  showRefCallback({ title: args.title, source: args.content, server: args.server, contentModel: args.contentModel });
                } else {
                  if (
                    result.content &&
                    result.content[1] &&
                    result.content[1].text &&
                    result.content[1].text.startsWith("Source:")
                  ) {
                    showRefCallback({
                      title: args.title,
                      source: result.content[1].text,
                      server: args.server,
                      contentModel: 'wikitext'
                    });
                  }
                }
              }}
              className="text-muted-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              Reference
            </a>
          </div>
          <div className="px-2 py-1 bg-muted/50 rounded-md border border-border/30 hover:bg-muted/70 transition-colors">
            <a
              href={url}
              className="text-muted-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              View
            </a>
          </div>
          <div className="px-2 py-1 bg-muted/50 rounded-md border border-border/30 hover:bg-muted/70 transition-colors">
            <a
              onClick={() => navigator.clipboard.writeText(url!)}
              className="text-muted-foreground"
            >
              Copy URL
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
