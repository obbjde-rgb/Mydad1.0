import React, { useState } from 'react';
import { Volume2, VolumeX, Download, Loader2 } from 'lucide-react';
import { generateRecitationStream } from '../services/aiService';

interface ReadAloudProps {
  text: string;
  className?: string;
  buttonClassName?: string;
  lang?: string;
  voiceName?: string;
}

export const ReadAloud: React.FC<ReadAloudProps> = ({ 
  text, 
  className = '', 
  buttonClassName = '', 
  lang = 'ar-SA',
  voiceName
}) => {
  const actualVoiceName = voiceName || localStorage.getItem('ai_recitation_voice') || 'Kore';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const stopRef = React.useRef(false);

  const stopAllAudio = () => {
    stopRef.current = true;
    window.speechSynthesis.cancel();
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    window.dispatchEvent(new CustomEvent('stop_all_audio'));
  };

  const handleReadAloud = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isSpeaking) {
      stopAllAudio();
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
          try { const settings = JSON.parse(localStorage.getItem('ai_recitation_settings') || '{}'); audio.playbackRate = settings.rate || 1.0; } catch (e) {}
          
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
          break; // Stop if user cancelled
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
      console.error("Advanced TTS failed:", error);
      // Fallback to simple TTS
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        try { const settings = JSON.parse(localStorage.getItem('ai_recitation_settings') || '{}'); utterance.rate = settings.rate || 0.9; } catch(e) {}
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      } else {
        setIsSpeaking(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quran_text_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        onClick={handleReadAloud}
        className={buttonClassName || `w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isSpeaking ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200/80 dark:hover:bg-amber-900/60'}`}
        aria-label={isSpeaking ? "إيقاف القراءة" : "قراءة بصوت عالٍ"}
        title={isSpeaking ? "إيقاف القراءة" : "قراءة بصوت عالٍ"}
        disabled={isLoading}
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <button
        onClick={handleDownload}
        className={buttonClassName || "w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/60 flex items-center justify-center transition-colors"}
        title="تنزيل النص"
      >
        <Download size={16} />
      </button>
    </span>
  );
};
