import React, { useState, useRef } from 'react';
import { Volume2, VolumeX, Download, Loader2 } from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import { generateRecitationStream } from '../services/aiService';

interface AdvancedReadAloudProps {
  text: string;
  className?: string;
  buttonClassName?: string;
  voiceName?: string;
}

export const AdvancedReadAloud: React.FC<AdvancedReadAloudProps> = ({ 
  text, 
  className = '', 
  buttonClassName = '', 
  voiceName
}) => {
  const actualVoiceName = voiceName || localStorage.getItem('ai_recitation_voice') || 'Kore';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const stopRef = useRef(false);

  const handleReadAloud = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isSpeaking) {
      stopRef.current = true;
      setIsSpeaking(false);
      return;
    }

    stopRef.current = false;
    setIsLoading(true);
    try {
      const stream = generateRecitationStream(text, actualVoiceName);
      
      const audioQueue: string[] = [];
      let isPlaying = false;
      let isFinishedGenerating = false;

      const playNext = () => {
        if (stopRef.current) {
          while(audioQueue.length > 0) {
            URL.revokeObjectURL(audioQueue.shift()!);
          }
          return;
        }
        
        if (audioQueue.length > 0) {
          isPlaying = true;
          const url = audioQueue.shift()!;
          const audio = new Audio(url);
          
          let nextCalled = false;
          const callNext = () => {
            if (!nextCalled) {
              nextCalled = true;
              URL.revokeObjectURL(url);
              playNext();
            }
          };

          audio.onended = callNext;
          audio.onerror = callNext;

          audio.play().catch(e => {
            if (e.name !== 'AbortError') console.error("Audio play error", e);
            callNext();
          });
        } else {
          isPlaying = false;
          if (isFinishedGenerating) {
            setIsSpeaking(false);
          }
        }
      };

      setIsSpeaking(true);
      
      for await (const chunk of stream) {
        if (stopRef.current) {
          while(audioQueue.length > 0) {
            URL.revokeObjectURL(audioQueue.shift()!);
          }
          break;
        }
        
        const audioUrl = `data:audio/wav;base64,${chunk.data}`;
        audioQueue.push(audioUrl);
        
        if (!isPlaying) {
          playNext();
        }
      }
      
      isFinishedGenerating = true;
      if (!isPlaying) {
        setIsSpeaking(false);
      }
      
    } catch (error) {
      const isHardQuota = error === "HARD_QUOTA_LIMIT" || (error instanceof Error && error.message === "HARD_QUOTA_LIMIT");
      if (!isHardQuota) {
        console.error("Advanced TTS failed:", error);
      } else {
        console.warn("Advanced TTS quota limit reached. Falling back to browser TTS.");
      }
      
      // Fallback to browser TTS
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.9;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        // Do not return early here to ensure finally block runs
      }
    } finally {
      setIsSpeaking(false);
      setIsLoading(false);
    }
  };

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <button
        onClick={handleReadAloud}
        className={buttonClassName || `p-3 rounded-2xl transition-all shadow-md hover:scale-110 ${isSpeaking ? 'bg-amber-500 text-white animate-pulse' : 'bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200'}`}
        aria-label={isSpeaking ? "إيقاف القراءة" : "قراءة بصوت عالٍ"}
        title={isSpeaking ? "إيقاف القراءة" : "قراءة بصوت عالٍ"}
        disabled={isLoading}
      >
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </span>
  );
};
