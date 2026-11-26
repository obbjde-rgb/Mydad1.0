import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Sparkles, ChevronLeft, Lock, Unlock } from 'lucide-react';

interface PaymentGateProps {
  onUnlock: () => void;
}

const PRAYERS = [
  [
    "اللَّهُمَّ اغْفِرْ لِأُمِّي مَرْيَم زَرُّوق وَارْحَمْهَا",
    "اللَّهُمَّ اغْفِرْ لِأَبِي مُحَمَّد سَرْدُونِي وَارْحَمْهُ"
  ],
  [
    "اللَّهُمَّ احْفَظْ وَالِدَتِي مَرْيَم زَرُّوق وَبَارِكْ فِيهَا",
    "اللَّهُمَّ احْفَظْ وَالِدِي مُحَمَّد سَرْدُونِي وَبَارِكْ فِيهِ"
  ],
  [
    "رَبِّ ارْحَمْ أُمِّي مَرْيَم زَرُّوق كَمَا رَبَّتْنِي صَغِيرًا",
    "رَبِّ ارْحَمْ أَبِي مُحَمَّد سَرْدُونِي كَمَا رَبَّانِي صَغِيرًا"
  ],
  [
    "اللَّهُمَّ اجْعَلْ أُمِّي مَرْيَم زَرُّوق مِنْ أَهْلِ الْجَنَّةِ",
    "اللَّهُمَّ اجْعَلْ أَبِي مُحَمَّد سَرْدُونِي مِنْ أَهْلِ الْجَنَّةِ"
  ],
  [
    "اللَّهُمَّ ارْزُقْ أُمِّي مَرْيَم زَرُّوق الصِّحَّةَ وَالْعَافِيَةَ",
    "اللَّهُمَّ ارْزُقْ أَبِي مُحَمَّد سَرْدُونِي الصِّحَّةَ وَالْعَافِيَةَ"
  ]
];

export const PaymentGate: React.FC<PaymentGateProps> = ({ onUnlock }) => {
  const [mode, setMode] = useState<'selection' | 'prayer'>('selection');
  const [clickedWords, setClickedWords] = useState<Set<string>>(new Set());
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 1000); // Show skip after 1 second
    return () => clearTimeout(timer);
  }, []);

  // Select a random prayer on mount
  const [prayer1, prayer2] = useMemo(() => {
    const randomPrayer = PRAYERS[Math.floor(Math.random() * PRAYERS.length)];
    return [randomPrayer[0].split(' '), randomPrayer[1].split(' ')];
  }, []);

  const allWords = useMemo(() => [
    ...prayer1.map((word, i) => ({ id: `p1_${i}`, word })),
    ...prayer2.map((word, i) => ({ id: `p2_${i}`, word }))
  ], [prayer1, prayer2]);

  const handleWordClick = (id: string) => {
    const newClicked = new Set(clickedWords);
    newClicked.add(id);
    setClickedWords(newClicked);

    if (newClicked.size === allWords.length) {
      setTimeout(() => {
        onUnlock();
      }, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0705] text-white p-4 overflow-y-auto select-none">
      {/* Subtle Ambient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-[0.03] islamic-pattern" />
      </div>

      <AnimatePresence mode="wait">
        {mode === 'selection' ? (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            className="max-w-md w-full bg-[#171412]/95 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-2xl border border-amber-900/40 text-center relative z-10 overflow-hidden"
          >
            <div className="mb-7 relative">
              <div className="w-16 h-16 mx-auto bg-amber-500/15 rounded-2xl flex items-center justify-center mb-5 border border-amber-500/30">
                <Lock className="w-7 h-7 text-amber-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2.5 text-amber-50 font-kufi">بوابة المداد</h1>
              <p className="text-amber-200/75 text-sm leading-relaxed max-w-sm mx-auto">
                مرحباً بك في رحاب القرآن. للبدء، اختر وسيلة للدخول:
              </p>
            </div>

            <div className="space-y-3.5">
              <button
                onClick={() => setMode('prayer')}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white py-3.5 px-6 rounded-xl font-bold text-base transition-all shadow-lg hover:bg-amber-500"
              >
                <Sparkles className="w-5 h-5 text-amber-100" />
                الدخول بالدعاء (مجاني)
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs font-bold text-amber-400/60">أو المساهمة</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <a
                href="https://pay.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-3 bg-white/[0.05] hover:bg-white/[0.1] text-white/90 py-3.5 px-6 rounded-xl font-bold text-base transition-colors border border-white/10 hover:border-white/25"
              >
                <CreditCard className="w-5 h-5 text-amber-300" />
                دعم التطبيق (1 درهم)
              </a>

              {showSkip && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={onUnlock}
                  className="mt-4 text-amber-400/70 hover:text-amber-300 text-xs font-bold transition-colors flex items-center gap-1.5 mx-auto"
                >
                  تخطي البداية والدخول مباشرة
                  <ChevronLeft size={15} />
                </motion.button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="prayer"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-3xl w-full bg-[#171412]/95 backdrop-blur-xl p-6 sm:p-10 rounded-2xl shadow-2xl border border-amber-900/40 text-center relative z-10"
          >
            <div className="mb-8">
              <div className="w-12 h-12 mx-auto rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-4">
                <Unlock className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-amber-100 font-kufi mb-2">
                تلاوة الدعاء لفتح البوابة
              </h2>
              <p className="text-amber-200/60 text-sm">
                المس الكلمات بقلبك ولسانك لتفتح آفاق المداد
              </p>
            </div>
            
            <div className="space-y-8 text-2xl sm:text-4xl font-quran leading-relaxed" dir="rtl">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-5">
                {prayer1.map((word, i) => {
                  const id = `p1_${i}`;
                  const isClicked = clickedWords.has(id);
                  return (
                    <motion.button
                      key={id}
                      whileHover={{ scale: isClicked ? 1 : 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleWordClick(id)}
                      className={`transition-all duration-300 relative ${
                        isClicked 
                          ? 'text-amber-300 font-bold' 
                          : 'text-white/30 hover:text-white/60 cursor-pointer'
                      }`}
                    >
                      {word}
                    </motion.button>
                  );
                })}
              </div>
              
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-5">
                {prayer2.map((word, i) => {
                  const id = `p2_${i}`;
                  const isClicked = clickedWords.has(id);
                  return (
                    <motion.button
                      key={id}
                      whileHover={{ scale: isClicked ? 1 : 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleWordClick(id)}
                      className={`transition-all duration-300 relative ${
                        isClicked 
                          ? 'text-amber-300 font-bold' 
                          : 'text-white/30 hover:text-white/60 cursor-pointer'
                      }`}
                    >
                      {word}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 max-w-md mx-auto">
              <div className="relative h-2.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${(clickedWords.size / allWords.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between mt-3 text-amber-300/70 text-xs font-bold tabular-nums">
                <span>اكتمال الدعاء</span>
                <span>{Math.round((clickedWords.size / allWords.length) * 100)}%</span>
              </div>
            </div>

            <button 
              onClick={() => setMode('selection')}
              className="mt-8 text-white/50 hover:text-white/80 transition-colors text-xs font-bold flex items-center gap-1.5 mx-auto"
            >
              <ChevronLeft size={15} className="rotate-180" />
              العودة للخيارات
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
