import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'icon' | 'button';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'button' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={
          variant === 'icon'
            ? 'p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center gap-2 font-bold text-sm'
            : 'flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all active:scale-95'
        }
        title="تثبيت التطبيق على الجهاز"
        aria-label="تثبيت التطبيق"
      >
        <Download size={20} />
        <span>تثبيت التطبيق</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 font-bold text-sm transition-all active:scale-95"
          title="تثبيت التطبيق على iOS"
          aria-label="تثبيت التطبيق على آيفون وآيباد"
        >
          <Download size={20} />
          <span>تثبيت التطبيق</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            dir="rtl"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1c1917] p-6 shadow-2xl border border-amber-200 dark:border-amber-800/40 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-amber-950 dark:text-amber-50">
                  تثبيت Medad live على جهازك
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  aria-label="إغلاق"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3 text-sm text-amber-900/80 dark:text-amber-100/80 leading-relaxed">
                <p className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-bold text-xs shrink-0">
                    1
                  </span>
                  <span>
                    اضغط على زر <strong>المشاركة</strong> <Share size={14} className="inline mx-1" /> في شريط متصفح Safari.
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-bold text-xs shrink-0">
                    2
                  </span>
                  <span>
                    مرّر للأسفل واختر <strong>إضافة إلى الصفحة الرئيسية</strong> <PlusSquare size={14} className="inline mx-1" />.
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-2xl bg-amber-700 hover:bg-amber-800 py-2.5 text-sm font-bold text-white transition-colors"
              >
                حسناً
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
