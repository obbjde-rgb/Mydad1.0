import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, CreditCard, Sparkles, ChevronLeft, Lock, Unlock, Moon, Sun } from 'lucide-react';

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

  const handleGooglePay = () => {
    window.open('https://pay.google.com/', '_blank');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0705] text-white p-4 overflow-hidden select-none">
      {/* Immersive Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-900/20 rounded-full blur-[60px] opacity-40"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-900/10 rounded-full blur-[60px] opacity-40"></div>
        
        {/* Islamic Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.03] islamic-pattern scale-150"></div>
        
        {/* Floating Particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: Math.random() * 1000 }}
            animate={{ 
              opacity: [0, 0.5, 0], 
              y: [Math.random() * 1000, Math.random() * 1000 - 500],
              x: [Math.random() * 100, Math.random() * 100 + 50]
            }}
            transition={{ 
              duration: 10 + Math.random() * 20, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute w-1 h-1 bg-amber-200 rounded-full"
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'selection' ? (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            className="max-w-lg w-full bg-white/[0.03] backdrop-blur-2xl p-10 md:p-14 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 text-center relative z-10 overflow-hidden"
          >
            {/* Decorative Arch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 opacity-10 pointer-events-none">
              <svg viewBox="0 0 400 200" className="w-full h-full fill-amber-500">
                <path d="M0,200 L0,100 C0,44.77 89.54,0 200,0 C310.46,0 400,44.77 400,100 L400,200 Z" />
              </svg>
            </div>

            <div className="mb-10 relative">
              <motion.div 
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="w-24 h-24 mx-auto bg-gradient-to-br from-amber-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mb-8 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)]"
              >
                <Lock className="w-10 h-10 text-amber-400" />
              </motion.div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-amber-50 font-kufi tracking-wide">بوابة المداد</h1>
              <p className="text-amber-200/70 text-lg leading-relaxed font-arabic max-w-sm mx-auto">
                مرحباً بك في رحاب القرآن. للبدء، اختر وسيلة لفتح قلبك وتطبيقك:
              </p>
            </div>

            <div className="space-y-5">
              <button
                onClick={() => setMode('prayer')}
                className="w-full group relative overflow-hidden flex items-center justify-center gap-4 bg-gradient-to-r from-amber-600 to-amber-500 text-white py-5 px-8 rounded-2xl font-bold text-xl transition-all duration-500 shadow-[0_10px_40px_rgba(217,119,6,0.3)] hover:shadow-[0_15px_50px_rgba(217,119,6,0.5)] hover:-translate-y-1 font-arabic"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
                <Sparkles className="w-7 h-7 text-amber-100 animate-pulse" />
                الدخول بالدعاء (مجاني)
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-white/10"></div>
                <span className="text-xs font-bold text-amber-500/40 uppercase tracking-widest font-sans">أو المساهمة</span>
                <div className="flex-1 h-px bg-white/10"></div>
              </div>

              <button
                onClick={handleGooglePay}
                className="w-full flex items-center justify-center gap-4 bg-white/[0.05] hover:bg-white/[0.1] text-white/90 py-5 px-8 rounded-2xl font-bold text-xl transition-all duration-300 border border-white/10 hover:border-white/30 font-arabic group"
              >
                <CreditCard className="w-6 h-6 text-amber-300 group-hover:scale-110 transition-transform" />
                دعم التطبيق (1 درهم)
              </button>

              {showSkip && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={onUnlock}
                  className="mt-6 text-amber-500/50 hover:text-amber-500 text-sm font-bold transition-colors flex items-center gap-2 mx-auto"
                >
                  تخطي البداية والدخول مباشرة
                  <ChevronLeft size={16} />
                </motion.button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="prayer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl w-full bg-white/[0.02] backdrop-blur-3xl p-8 md:p-16 rounded-[4rem] shadow-2xl border border-white/10 text-center relative z-10"
          >
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="inline-block p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-6">
                <Unlock className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-amber-200 font-kufi mb-4">
                تلاوة الدعاء لفتح البوابة
              </h2>
              <p className="text-amber-200/40 font-arabic text-lg">
                المس الكلمات بقلبك ولسانك لتفتح آفاق المداد
              </p>
            </motion.div>
            
            <div className="space-y-12 text-4xl md:text-6xl font-quran leading-[2] md:leading-[2.2]" dir="rtl">
              {/* First Prayer */}
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-8">
                {prayer1.map((word, i) => {
                  const id = `p1_${i}`;
                  const isClicked = clickedWords.has(id);
                  return (
                    <motion.button
                      key={id}
                      whileHover={{ scale: isClicked ? 1 : 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleWordClick(id)}
                      className={`transition-all duration-1000 relative ${
                        isClicked 
                          ? 'text-amber-300 drop-shadow-[0_0_30px_rgba(245,158,11,0.8)] scale-110 font-bold' 
                          : 'text-white/20 hover:text-white/50 cursor-pointer'
                      }`}
                    >
                      {word}
                      {isClicked && (
                        <motion.div
                          layoutId={`sparkle-${id}`}
                          className="absolute -top-6 -right-6 text-amber-400"
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                        >
                          <Sparkles className="w-8 h-8 opacity-40" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
              
              {/* Second Prayer */}
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-8">
                {prayer2.map((word, i) => {
                  const id = `p2_${i}`;
                  const isClicked = clickedWords.has(id);
                  return (
                    <motion.button
                      key={id}
                      whileHover={{ scale: isClicked ? 1 : 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleWordClick(id)}
                      className={`transition-all duration-1000 relative ${
                        isClicked 
                          ? 'text-amber-300 drop-shadow-[0_0_30px_rgba(245,158,11,0.8)] scale-110 font-bold' 
                          : 'text-white/20 hover:text-white/50 cursor-pointer'
                      }`}
                    >
                      {word}
                      {isClicked && (
                        <motion.div
                          layoutId={`sparkle-${id}`}
                          className="absolute -top-6 -right-6 text-amber-400"
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                        >
                          <Sparkles className="w-8 h-8 opacity-40" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="mt-20 max-w-xl mx-auto">
              <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 bg-[length:200%_100%] animate-shimmer"
                  initial={{ width: 0 }}
                  animate={{ width: `${(clickedWords.size / allWords.length) * 100}%` }}
                  transition={{ duration: 0.8, ease: "circOut" }}
                />
              </div>
              <div className="flex justify-between mt-4 text-amber-500/40 text-xs font-bold tracking-widest uppercase">
                <span>اكتمال الدعاء</span>
                <span>{Math.round((clickedWords.size / allWords.length) * 100)}%</span>
              </div>
            </div>

            <button 
              onClick={() => setMode('selection')}
              className="mt-12 text-white/30 hover:text-white/60 transition-colors text-sm font-arabic flex items-center gap-2 mx-auto"
            >
              <ChevronLeft size={16} className="rotate-180" />
              العودة للخيارات
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 3s linear infinite;
        }
      `}} />
    </div>
  );
};
