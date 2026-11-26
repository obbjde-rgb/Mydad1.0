import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageItem } from './MessageItem';
import { AIMessage } from '../../services/aiService';
import { Brain, Cpu } from 'lucide-react';

export const MessageList = ({ 
  messages,
  handleAIRecitation,
  stopRecitation,
  isGeneratingAudio,
  sendMessage,
  copyToClipboard,
  shareMessage,
  copyFeedback,
  audioUrls,
  downloadAudioFile,
  selectedVoice,
  onRegenerate,
  onEdit,
  isLoading,
  selectedModel,
  providerName,
  isZenMode
}: {
  messages: AIMessage[],
  handleAIRecitation: (text: string, id: number) => void,
  stopRecitation: () => void,
  isGeneratingAudio: string | null,
  sendMessage: (text: string) => void,
  copyToClipboard: (text: string, id: string) => void,
  shareMessage: (text: string) => void,
  copyFeedback: string | null,
  audioUrls: Record<string, string>,
  downloadAudioFile: (url: string, prefix: string) => void,
  selectedVoice: string,
  onRegenerate: (index: number) => void,
  onEdit: (index: number) => void,
  isLoading: boolean,
  selectedModel: string,
  providerName: string,
  isZenMode: boolean
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth custom-scrollbar"
    >
      <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <AnimatePresence initial={false}>
          {messages.map((m, idx) => (
            <MessageItem 
              key={idx}
              m={m}
              index={idx}
              handleAIRecitation={handleAIRecitation}
              stopRecitation={stopRecitation}
              isGeneratingAudio={isGeneratingAudio}
              sendMessage={sendMessage}
              copyToClipboard={copyToClipboard}
              shareMessage={shareMessage}
              copyFeedback={copyFeedback}
              audioUrl={audioUrls[idx]}
              downloadAudioFile={downloadAudioFile}
              selectedVoice={selectedVoice}
              onRegenerate={onRegenerate}
              onEdit={onEdit}
              selectedModel={selectedModel}
              providerName={providerName}
            />
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-start"
          >
            <div className="bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-md p-5 rounded-3xl rounded-tl-none border border-amber-100 dark:border-amber-900/50 shadow-sm">
              <div className="flex gap-2">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }} 
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-2 h-2 bg-amber-400 rounded-full" 
                />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }} 
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                  className="w-2 h-2 bg-amber-500 rounded-full" 
                />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }} 
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                  className="w-2 h-2 bg-amber-600 rounded-full" 
                />
              </div>
              <p className="mt-3 text-xs text-amber-800/60 dark:text-amber-200/60 font-sans" dir="rtl">جاري استحضار المدد...</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
