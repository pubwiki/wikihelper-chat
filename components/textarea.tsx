import { modelID } from "@/ai/providers";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { ArrowUp, Loader2 } from "lucide-react";
import { ModelPicker } from "./model-picker";
import { ImageUpload } from "./image-upload";

interface InputProps {
  input: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
  status: string;
  stop: () => void;
  selectedModel: modelID;
  setSelectedModel: (model: modelID) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  isUploading: boolean;
}

export const Textarea = ({
  input,
  handleInputChange,
  isLoading,
  status,
  stop,
  selectedModel,
  setSelectedModel,
  imageFile,
  setImageFile,
  isUploading
}: InputProps) => {
  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <div className="relative w-full">
      <ShadcnTextarea
        className="resize-none bg-background/50 dark:bg-muted/50 backdrop-blur-sm w-full rounded-2xl pr-12 pt-4 pb-16 border-input focus-visible:ring-ring placeholder:text-muted-foreground"
        value={input}
        autoFocus
        placeholder="Send a message..."
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !(e.shiftKey || e.ctrlKey) && !isLoading && input.trim()) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const { selectionStart, selectionEnd, value } = e.currentTarget;
            const newValue =
              value.substring(0, selectionStart) +
              "\n" +
              value.substring(selectionEnd);
            e.currentTarget.value = newValue;

            handleInputChange({
              ...e,
              target: { ...e.currentTarget, value: newValue },
            } as React.ChangeEvent<HTMLTextAreaElement>);

          }
        }}
      />

      <ModelPicker
        setSelectedModel={setSelectedModel}
        selectedModel={selectedModel}
      />
      <ImageUpload imageFile={imageFile} setImageFile={setImageFile} />

      <button
        type={ (isStreaming || isUploading) ? "button" : "submit"}
        onClick={isStreaming ? stop : undefined}
        disabled={
          (!isStreaming && !input.trim()) ||
          (isStreaming && status === "submitted") ||
          isUploading
        }
        className="absolute right-2 bottom-2 rounded-full p-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed transition-all duration-200"
      >
        {(isStreaming || isUploading) ? (
          <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
        ) : (
          <ArrowUp className="h-4 w-4 text-primary-foreground" />
        )}
      </button>
    </div>
  );
};
