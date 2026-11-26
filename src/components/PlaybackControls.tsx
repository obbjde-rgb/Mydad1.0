import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Square, Volume2, SkipBack, SkipForward, Download, Share2 } from 'lucide-react';
import { downloadAudio, shareAudio } from '../services/audioCacheService';

interface PlaybackControlsProps {
  isPlaying: boolean;
  activeAyah: { surah: number; ayah: number } | null;
  quranData: any[] | null;
  audioProgress: number;
  currentAudioData: Uint8Array | null;
  currentMimeType: string;
  togglePlayPause: () => void;
  stopRecitation: () => void;
  skipForward: () => void;
  skipBackward: () => void;
}

export const PlaybackControls = ({
  isPlaying,
  activeAyah,
  quranData,
  audioProgress,
  currentAudioData,
  currentMimeType,
  togglePlayPause,
  stopRecitation,
  skipForward,
  skipBackward,
}: PlaybackControlsProps) => {
  return (
    <AnimatePresence>
      {(isPlaying || activeAyah) && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-[100]"
        >
          <div className="bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 dark:border-amber-900/30 flex items-center gap-6">
            <div className="flex items-center gap-3">
              <button
                onClick={skipBackward}
                className="w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all"
              >
                <SkipBack size={20} />
              </button>
              <button
                onClick={togglePlayPause}
                className="w-16 h-16 flex items-center justify-center bg-amber-700 text-white rounded-full hover:bg-amber-800 transition-all shadow-lg transform hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
              </button>
              <button
                onClick={skipForward}
                className="w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all"
              >
                <SkipForward size={20} />
              </button>
              <button
                onClick={stopRecitation}
                className="w-12 h-12 flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-all shadow-sm"
              >
                <Square size={20} fill="currentColor" />
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center text-amber-800 dark:text-amber-300 font-bold">
                <span className="text-lg">الآية {activeAyah?.ayah === 0 ? 1 : activeAyah?.ayah}</span>
                <span className="text-xl">{quranData?.find(s => s.id === activeAyah?.surah)?.name}</span>
              </div>
              <div className="relative h-2 bg-amber-100 dark:bg-amber-900/50 rounded-full overflow-hidden">
                <motion.div
                  className="absolute top-0 left-0 h-full bg-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.5)]"
                  style={{ width: `${audioProgress}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-amber-600">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (currentAudioData && activeAyah) {
                      const fileName = `recitation_${activeAyah.surah}_${activeAyah.ayah}.wav`;
                      downloadAudio(currentAudioData, fileName, currentMimeType);
                    }
                  }}
                  disabled={!currentAudioData}
                  className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full hover:bg-amber-200 transition-all disabled:opacity-50"
                  title="تحميل التلاوة"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={() => {
                    if (currentAudioData && activeAyah) {
                      const fileName = `recitation_${activeAyah.surah}_${activeAyah.ayah}.wav`;
                      shareAudio(currentAudioData, fileName, currentMimeType);
                    }
                  }}
                  disabled={!currentAudioData}
                  className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full hover:bg-amber-200 transition-all disabled:opacity-50"
                  title="مشاركة التلاوة"
                >
                  <Share2 size={18} />
                </button>
              </div>
              <span className="text-[10px] font-bold">مباشر</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
