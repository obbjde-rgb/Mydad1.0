import React, { useState, useRef, useEffect, useImperativeHandle } from 'react';
import { Send, RefreshCw, MicOff, Mic, Paperclip, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioWaveform } from '../AudioWaveform';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../lib/utils';

export interface ChatInputRef {
  append: (text: string) => void;
  clear: () => void;
  get: () => string;
  set: (text: string) => void;
}

export interface AttachmentType {
  data: string;
  mimeType: string;
  filename: string;
}

export const ChatInput = React.memo(React.forwardRef<ChatInputRef, { 
  onSendMessage: (text: string, attachments?: AttachmentType[]) => void, 
  isLoading: boolean, 
  isListening?: boolean, 
  isProcessingAudio?: boolean,
  toggleListening?: () => void,
  draftKey?: string
}>(({ 
  onSendMessage, 
  isLoading, 
  isListening = false, 
  isProcessingAudio = false,
  toggleListening,
  draftKey = 'midad_chat_input_draft'
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localInput, setLocalInput] = useState(() => {
    return draftKey ? safeLocalStorageGet(draftKey) || '' : '';
  });
  const [attachments, setAttachments] = useState<AttachmentType[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (files: FileList | File[]) => {
    const newAttachments: AttachmentType[] = [];
    let loadedCount = 0;
    const fileArray = Array.from(files);
    
    if (fileArray.length === 0) return;

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Str = (reader.result as string).split(',')[1];
        newAttachments.push({ data: base64Str, mimeType: file.type, filename: file.name });
        loadedCount++;
        
        if (loadedCount === fileArray.length) {
          setAttachments(prev => [...prev, ...newAttachments]);
          // Reset the input value so that the same files can be selected again if needed
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.onerror = (err) => {
        console.error("Error reading file:", file.name, err);
        loadedCount++;
        if (loadedCount === fileArray.length && newAttachments.length > 0) {
          setAttachments(prev => [...prev, ...newAttachments]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  useEffect(() => {
    if (draftKey) {
      safeLocalStorageSet(draftKey, localInput);
    }
  }, [localInput, draftKey]);

  useImperativeHandle(ref, () => ({
    append: (text: string) => {
      setLocalInput(prev => {
        const next = prev + (prev ? ' ' : '') + text;
        if (draftKey) safeLocalStorageSet(draftKey, next);
        return next;
      });
    },
    clear: () => {
      setLocalInput('');
      if (draftKey) safeLocalStorageSet(draftKey, '');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    },
    get: () => localInput,
    set: (text: string) => {
      setLocalInput(text);
      if (draftKey) safeLocalStorageSet(draftKey, text);
    }
  }));

  const handleSend = () => {
    if ((localInput.trim() || attachments.length > 0) && !isLoading && !isProcessingAudio) {
      onSendMessage(localInput, attachments.length > 0 ? attachments : undefined);
      setLocalInput('');
      setAttachments([]);
      if (draftKey) safeLocalStorageSet(draftKey, '');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="w-full flex justify-center"
          >
            <AudioWaveform isListening={isListening} className="w-full justify-between shadow-md" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Attachments List */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex flex-wrap gap-2 p-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/40 dark:border-amber-800/40 max-h-32 overflow-y-auto w-fit"
            dir="rtl"
          >
            {attachments.map((att, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-2 p-1.5 bg-white dark:bg-[#1a1816] text-amber-900 dark:text-amber-100 rounded-xl max-w-[240px] overflow-hidden text-xs border border-amber-200/50 dark:border-amber-800/50 shadow-sm shrink-0"
              >
                {att.mimeType.startsWith('image/') ? (
                  <img 
                    src={`data:${att.mimeType};base64,${att.data}`} 
                    alt={att.filename} 
                    className="w-6 h-6 rounded object-cover border border-amber-200"
                  />
                ) : att.mimeType.startsWith('video/') ? (
                  <span className="text-sm font-sans" title="فيديو">🎥</span>
                ) : att.mimeType.startsWith('audio/') ? (
                  <span className="text-sm font-sans" title="ملف صوتي">🎵</span>
                ) : (
                  <span className="text-sm font-sans" title="ملف">📎</span>
                )}
                <span className="truncate max-w-[120px] font-medium" title={att.filename}>{att.filename}</span>
                <button 
                  onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} 
                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 p-1 rounded-full transition-colors"
                  title="إزالة المرفق"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`w-full flex gap-1.5 sm:gap-3 items-end bg-white/50 dark:bg-[#1c1917]/50 backdrop-blur-md p-1.5 sm:p-2 rounded-3xl border transition-all duration-300 relative ${
          dragActive 
            ? 'border-dashed border-2 border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 scale-[1.01]' 
            : 'border-amber-200/50 dark:border-amber-800/50 shadow-sm focus-within:shadow-md focus-within:border-amber-300 dark:focus-within:border-amber-700'
        }`}
      >
        {dragActive && (
          <div className="absolute inset-0 bg-amber-500/10 dark:bg-amber-500/20 backdrop-blur-[2px] rounded-3xl flex items-center justify-center border-2 border-dashed border-amber-500 pointer-events-none z-30">
            <p className="text-amber-800 dark:text-amber-200 font-bold font-kufi text-xs sm:text-sm animate-pulse flex items-center gap-2">
              <span>📥</span>
              <span>ألقِ ملفات الصوت، الفيديو أو الصور هنا للتحليل التجويدي الدقيق...</span>
            </p>
          </div>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept="image/*,video/*,audio/*,application/pdf,text/*" 
          multiple 
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isProcessingAudio}
          className="flex-shrink-0 p-2 sm:p-2.5 rounded-full text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
          title="إرفاق ملفات"
        >
          <Paperclip size={20} />
        </button>
        <div className="relative flex-shrink-0">
          {isListening && (
            <>
              <motion.div 
                className="absolute -inset-1 rounded-2xl bg-rose-500/30"
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.1, 0.6] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              />
              <motion.div 
                className="absolute -inset-2 rounded-2xl bg-amber-500/20"
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut", delay: 0.3 }}
              />
            </>
          )}
          <button 
            onClick={toggleListening}
            disabled={isProcessingAudio}
            className={`relative z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl transition-all duration-300 ${isProcessingAudio ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-500 cursor-wait' : isListening ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 scale-105' : 'bg-amber-100/50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800 hover:scale-105'}`}
            title={isProcessingAudio ? 'جاري معالجة الصوت...' : isListening ? 'إيقاف الاستماع' : 'تحدث بالصوت'}
          >
            {isProcessingAudio ? <RefreshCw size={20} className="animate-spin" /> : isListening ? <MicOff size={20} className="animate-pulse" /> : <Mic size={20} />}
          </button>
        </div>
        
        <div className="flex flex-col flex-1 relative min-w-0">
          <textarea 
            ref={textareaRef}
            value={localInput} 
            onChange={(e) => {
              setLocalInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isProcessingAudio ? 'جاري تحويل الصوت...' : isListening ? 'جاري التقاط صوتك... تتحدث الآن' : 'اكتب سؤالك أو ارفع تلاوتك/صورك هنا للتحليل التجويدي الدقيق...'}
            className="w-full py-2.5 px-2 sm:py-3 sm:px-4 bg-transparent border-none outline-none text-amber-950 dark:text-amber-50 transition-all resize-none min-h-[40px] sm:min-h-[48px] max-h-[200px] placeholder:text-amber-900/40 dark:placeholder:text-amber-100/30 leading-relaxed block text-sm sm:text-base"
            dir="rtl"
            rows={1}
            disabled={isProcessingAudio}
          />
        </div>
        
        <button 
          onClick={handleSend} 
          disabled={isLoading || (!localInput.trim() && attachments.length === 0)}
          className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md shadow-amber-900/20 active:scale-95 flex-shrink-0"
        >
          <Send size={18} className="rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}));
