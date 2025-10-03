import React from "react";
import { toast } from "sonner";

interface ImageUploadProps {
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ imageFile, setImageFile }) => {
  const MAX_SIZE = 4 * 1024 * 1024;
  const [preview, setPreview] = React.useState<string>("blank");

  React.useEffect(() => {
    if (imageFile) {
      setPreview(URL.createObjectURL(imageFile));
    } else {
      setPreview("blank");
    }
    // 清理URL对象
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [imageFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
      if (selectedFile && selectedFile.size > MAX_SIZE) {
        toast.error("Image size exceeds 4MB limit.");
        e.target.value = "";
        return;
      }
      setImageFile(selectedFile);
  };

  const handleRemove = () => {
    setImageFile(null);
  };

  // 文件名中间省略
  const getShortName = (name: string) => {
    if (name.length <= 16) return name;
    const ext = name.lastIndexOf(".") !== -1 ? name.slice(name.lastIndexOf(".")) : "";
    const start = name.slice(0, 8);
    const end = name.slice(-4);
    return `${start}...${end}${ext}`;
  };

  return (
    <div className="absolute left-2 bottom-2">
      {!imageFile ? (
        <label htmlFor="image-upload" className="rounded-md bg-transparent px-3 py-2 text-sm flex items-center justify-center cursor-pointer border border-input hover:bg-secondary transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4a3 3 0 014 0l4 4M4 16V8a2 2 0 012-2h12a2 2 0 012 2v8M4 16h16" /></svg>
          <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleChange} />
        </label>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-input px-2 py-2 bg-secondary">
          <div className="w-8 h-8 rounded-md overflow-hidden flex items-center justify-center bg-muted">
            <img src={preview} alt="preview" className="object-cover w-full h-full" />
          </div>
          <span className="max-w-[100px] text-xs text-muted-foreground truncate">{getShortName(imageFile.name)}</span>
          <button type="button" onClick={handleRemove} className="ml-1 text-destructive hover:bg-destructive/10 rounded-full p-1 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
};
