import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Share2, Copy } from 'lucide-react';
import { ReadAloud } from './ReadAloud';

export const HijriClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hijriDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(time);

  const gregorianDate = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(time);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const ampm = hours >= 12 ? 'م' : 'ص';
  const hours12 = hours % 12 || 12;

  const padZero = (num: number) => num.toString().padStart(2, '0');
  const timeString = `${padZero(hours12)}:${padZero(minutes)}:${padZero(seconds)}`;
  const fullDateTimeText = `الوقت الآن هو ${timeString} ${ampm}، والتاريخ الهجري هو ${hijriDate}، والتاريخ الميلادي هو ${gregorianDate}`;

  return (
    <div className="w-full h-full bg-white/95 dark:bg-[#171412]/95 rounded-2xl p-5 border border-amber-200/50 dark:border-amber-900/40 shadow-sm flex flex-col justify-between gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-amber-950 dark:text-amber-100">
          <div className="w-9 h-9 rounded-xl bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div className="flex items-baseline gap-1.5 tabular-nums" dir="ltr">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight">{timeString}</span>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{ampm}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <ReadAloud
            text={fullDateTimeText}
            buttonClassName="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 transition-colors"
          />
          <button
            onClick={() => navigator.clipboard.writeText(fullDateTimeText)}
            className="w-8 h-8 flex items-center justify-center text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg transition-colors"
            title="نسخ الوقت والتاريخ"
          >
            <Copy size={15} />
          </button>
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              onClick={() => {
                navigator.share({
                  title: 'الوقت والتاريخ',
                  text: fullDateTimeText,
                }).catch(console.error);
              }}
              className="w-8 h-8 flex items-center justify-center text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg transition-colors"
              title="مشاركة"
            >
              <Share2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-amber-100/70 dark:border-amber-900/30 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-amber-950 dark:text-amber-100 font-bold">
          <CalendarIcon size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{hijriDate}</span>
        </div>
        <span className="text-amber-800/70 dark:text-amber-300/70 font-medium">
          {gregorianDate} م
        </span>
      </div>
    </div>
  );
};
