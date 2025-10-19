import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ApiKeyManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyManager({ open, onOpenChange }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");

  // Load values from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem("OPENAI_API_KEY");
    const storedEndpoint = localStorage.getItem("OPENAI_API_ENDPOINT");

    if (storedKey) setApiKey(storedKey);
    if (storedEndpoint) setEndpoint(storedEndpoint);
  }, []);

  // Save API key and endpoint to localStorage
  const handleSave = () => {
    try {
      if (apiKey.trim()) {
        localStorage.setItem("OPENAI_API_KEY", apiKey.trim());
      } else {
        localStorage.removeItem("OPENAI_API_KEY");
      }

      if (endpoint.trim()) {
        localStorage.setItem("OPENAI_API_ENDPOINT", endpoint.trim());
      } else {
        localStorage.removeItem("OPENAI_API_ENDPOINT");
      }

      toast.success("Settings saved successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    }
  };

  // Clear all values
  const handleClear = () => {
    try {
      localStorage.removeItem("OPENAI_API_KEY");
      localStorage.removeItem("OPENAI_API_ENDPOINT");
      setApiKey("");
      setEndpoint("");
      toast.success("Settings cleared");
    } catch (error) {
      console.error("Error clearing settings:", error);
      toast.error("Failed to clear settings");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
          <DialogDescription>
            Configure OpenAI-compatible API Key and Endpoint. Settings will be saved in your browser&apos;s local storage.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="endpoint">API Endpoint</Label>
            <Input
              id="endpoint"
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="destructive" onClick={handleClear}>
            Clear Settings
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
