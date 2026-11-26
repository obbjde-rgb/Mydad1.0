import fs from 'fs';

let content = fs.readFileSync('src/components/chat/ChatInput.tsx', 'utf-8');

const oldProps = `  onSendMessage: (text: string) => void, 
  isLoading: boolean, `;

const newProps = `  onSendMessage: (text: string, inlineData?: { data: string, mimeType: string, filename: string }) => void, 
  isLoading: boolean, `;

content = content.replace(oldProps, newProps);

const importsOld = `import { Send, RefreshCw, MicOff, Mic } from 'lucide-react';`;
const importsNew = `import { Send, RefreshCw, MicOff, Mic, Paperclip, X } from 'lucide-react';`;
content = content.replace(importsOld, importsNew);

const stateOld = `  const [localInput, setLocalInput] = useState(() => {
    return draftKey ? safeLocalStorageGet(draftKey) || '' : '';
  });`;

const stateNew = `  const [localInput, setLocalInput] = useState(() => {
    return draftKey ? safeLocalStorageGet(draftKey) || '' : '';
  });
  const [attachment, setAttachment] = useState<{data: string, mimeType: string, filename: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Str = (reader.result as string).split(',')[1];
        setAttachment({ data: base64Str, mimeType: file.type, filename: file.name });
      };
      reader.readAsDataURL(file);
    }
  };`;

content = content.replace(stateOld, stateNew);

const oldHandleSend = `  const handleSend = () => {
    if (localInput.trim() && !isLoading && !isProcessingAudio) {
      onSendMessage(localInput);
      setLocalInput('');
      if (draftKey) safeLocalStorageSet(draftKey, '');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };`;

const newHandleSend = `  const handleSend = () => {
    if ((localInput.trim() || attachment) && !isLoading && !isProcessingAudio) {
      onSendMessage(localInput, attachment || undefined);
      setLocalInput('');
      setAttachment(null);
      if (draftKey) safeLocalStorageSet(draftKey, '');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };`;

content = content.replace(oldHandleSend, newHandleSend);

const attachmentUI = `
      <div className="w-full flex gap-1.5 sm:gap-3 items-end bg-white/50 dark:bg-[#1c1917]/50 backdrop-blur-md p-1.5 sm:p-2 rounded-3xl border border-amber-200/50 dark:border-amber-800/50 shadow-sm focus-within:shadow-md focus-within:border-amber-300 dark:focus-within:border-amber-700 transition-all duration-300">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,application/pdf,text/*" />
        
        <div className="flex flex-col flex-1">
          {attachment && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl w-fit max-w-[200px] sm:max-w-xs overflow-hidden text-xs">
              <span className="truncate">{attachment.filename}</span>
              <button onClick={() => setAttachment(null)} className="text-red-500 hover:text-red-600"><X size={14} /></button>
            </div>
          )}
          <textarea
`;

content = content.replace(
`      <div className="w-full flex gap-1.5 sm:gap-3 items-end bg-white/50 dark:bg-[#1c1917]/50 backdrop-blur-md p-1.5 sm:p-2 rounded-3xl border border-amber-200/50 dark:border-amber-800/50 shadow-sm focus-within:shadow-md focus-within:border-amber-300 dark:focus-within:border-amber-700 transition-all duration-300">
        <div className="relative flex-shrink-0">`,
`      <div className="w-full flex gap-1.5 sm:gap-3 items-end bg-white/50 dark:bg-[#1c1917]/50 backdrop-blur-md p-1.5 sm:p-2 rounded-3xl border border-amber-200/50 dark:border-amber-800/50 shadow-sm focus-within:shadow-md focus-within:border-amber-300 dark:focus-within:border-amber-700 transition-all duration-300">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,application/pdf,text/*" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isProcessingAudio}
          className="flex-shrink-0 p-2 sm:p-2.5 rounded-full text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
          title="إرفاق ملف"
        >
          <Paperclip size={20} />
        </button>
        <div className="relative flex-shrink-0">`
);

// We need to inject the attachment pill before the textarea
content = content.replace(
`          <textarea`,
`          <div className="flex flex-col flex-1 relative">
          {attachment && (
            <div className="absolute -top-10 right-0 flex items-center gap-2 p-1.5 bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 rounded-lg w-fit max-w-[200px] overflow-hidden text-xs z-10 border border-amber-200 dark:border-amber-700 shadow-sm">
              <span className="truncate">{attachment.filename}</span>
              <button onClick={() => setAttachment(null)} className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-1 rounded-full"><X size={12} /></button>
            </div>
          )}
          <textarea`
);
// Make sure to close the div added above textarea
content = content.replace(
`            className="w-full resize-none min-h-[40px] max-h-32 bg-transparent border-0 py-2 sm:py-2.5 px-1 sm:px-3 text-sm sm:text-base focus:outline-none placeholder-amber-700/50 dark:placeholder-amber-400/50 text-slate-800 dark:text-amber-50 scrollbar-thin scrollbar-thumb-amber-200 dark:scrollbar-thumb-amber-800 scrollbar-track-transparent"
          />`,
`            className="w-full resize-none min-h-[40px] max-h-32 bg-transparent border-0 py-2 sm:py-2.5 px-1 sm:px-3 text-sm sm:text-base focus:outline-none placeholder-amber-700/50 dark:placeholder-amber-400/50 text-slate-800 dark:text-amber-50 scrollbar-thin scrollbar-thumb-amber-200 dark:scrollbar-thumb-amber-800 scrollbar-track-transparent"
          />
          </div>`
);


fs.writeFileSync('src/components/chat/ChatInput.tsx', content);
