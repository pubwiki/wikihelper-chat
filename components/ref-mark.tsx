import React from "react";

interface RefMarkProps {
  refMark: string | null;
  setRefMark: (refMark: string | null) => void;
}

export const RefMark: React.FC<RefMarkProps> = ({ refMark, setRefMark }) => {

  const handleRemove = () => {
    setRefMark(null);
  };

  const getShortText = (text: string) => {
    if (text.length <= 16) return text;
    const start = text.slice(0, 8);
    const end = text.slice(-4);
    return `${start}...${end}`;
  };

  return (
    <div className="absolute left-2 bottom-2">
      {refMark && (
        <div className="flex items-center gap-2 rounded-md border border-input px-2 py-2 bg-secondary">
          <span className="max-w-[100px] text-xs text-muted-foreground truncate">{getShortText(refMark)}</span>
          <button type="button" onClick={handleRemove} className="ml-1 text-destructive hover:bg-destructive/10 rounded-full p-1 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
};
