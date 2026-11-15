import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, Brain, Loader2, Image as ImageIcon, Maximize2, Edit2, 
  RefreshCw, Check, Copy, Share2, StopCircle, Volume2, Download, Sparkles, Zap, Cpu,
  Book, ChevronRight, Code
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AIMessage } from '../../services/aiService';
import { saveImageToCache, getImageFromCache } from '../../lib/imageCache';
import { AdvancedReadAloud } from '../AdvancedReadAloud';
import { extractQuranNavigationDetails } from '../../lib/utils';
import rehypeRaw from 'rehype-raw';

const HtmlPreviewBlock: React.FC<{ code: string }> = ({ code }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);

  const unescapeHtml = (str: string) => {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  };

  const cleanCode = unescapeHtml(code.trim());

  const fullIframeDoc = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { margin: 0; padding: 12px; background-color: #09090b; color: #f5f5f5; font-family: 'Cairo', 'Tajawal', sans-serif; }
      </style>
    </head>
    <body>
      ${cleanCode}
    </body>
    </html>
  `;

  return (
    <div className="my-4 rounded-2xl border border-amber-500/40 overflow-hidden bg-zinc-900 shadow-2xl" dir="rtl">
      <div className="bg-zinc-800/90 border-b border-zinc-700/80 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'preview' ? 'bg-amber-600 text-white shadow-md' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>المعاينة البصرية الحية (Graph / Card)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'code' ? 'bg-amber-600 text-white shadow-md' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>كود المصدر</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(cleanCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="px-2.5 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 text-amber-300 text-[11px] font-bold flex items-center gap-1 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
        </button>
      </div>

      {activeTab === 'preview' ? (
        <div className="w-full bg-zinc-950 p-2 overflow-x-auto min-h-[320px] flex items-center justify-center">
          <iframe
            srcDoc={fullIframeDoc}
            title="Interactive Visual Preview"
            className="w-full h-[480px] border-0 rounded-xl bg-transparent"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      ) : (
        <pre className="p-4 bg-zinc-950 text-amber-200 text-xs font-mono overflow-x-auto max-h-[400px] leading-relaxed" dir="ltr">
          <code>{cleanCode}</code>
        </pre>
      )}
    </div>
  );
};

export const MessageItem = React.memo(({ 
  m, 
  index,
  handleAIRecitation, 
  stopRecitation,
  isGeneratingAudio,
  sendMessage, 
  copyToClipboard, 
  shareMessage,
  copyFeedback,
  audioUrl,
  downloadAudioFile,
  selectedVoice,
  onRegenerate,
  onEdit,
  selectedModel,
  providerName
}: { 
  m: AIMessage, 
  index: number,
  handleAIRecitation: (text: string, id: number) => void, 
  stopRecitation: () => void,
  isGeneratingAudio: string | null,
  sendMessage: (text: string) => void,
  copyToClipboard: (text: string, id: string) => void,
  shareMessage: (text: string) => void,
  copyFeedback: string | null,
  audioUrl?: string,
  downloadAudioFile: (url: string, prefix: string) => void,
  selectedVoice: string,
  onRegenerate: (index: number) => void,
  onEdit: (index: number) => void,
  selectedModel: string,
  providerName: string
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string>('');

  useEffect(() => {
    if (!m.imageUrl) {
      setLocalImageUrl('');
      setImgLoaded(false);
      setImgError(false);
      return;
    }

    let isMounted = true;
    let objectUrl = '';

    const handleLoadImage = async () => {
      try {
        setImgError(false);
        setImgLoaded(false);

        if (!m.imageUrl) return;

        // Skip network fetch / IndexedDB caching for local blob and data URLs
        if (m.imageUrl.startsWith('blob:') || m.imageUrl.startsWith('data:')) {
          if (isMounted) {
            setLocalImageUrl(m.imageUrl);
            setImgLoaded(true);
          }
          return;
        }

        const cachedBlob = await getImageFromCache(m.imageUrl);
        if (cachedBlob && isMounted) {
          objectUrl = URL.createObjectURL(cachedBlob);
          setLocalImageUrl(objectUrl);
          setImgLoaded(true);
          return;
        }

        const res = await fetch(m.imageUrl);
        if (!res.ok) throw new Error('Failed to load image');
        const blob = await res.blob();

        await saveImageToCache(m.imageUrl, blob);

        if (isMounted) {
          objectUrl = URL.createObjectURL(blob);
          setLocalImageUrl(objectUrl);
          setImgLoaded(true);
        }
      } catch (err) {
        console.warn("Local caching of image failed, using direct image URL:", err);
        if (isMounted) {
          setLocalImageUrl(m.imageUrl!);
        }
      }
    };

    handleLoadImage();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [m.imageUrl]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
    >
      <div className={`p-5 rounded-3xl shadow-sm relative group transition-all duration-300 hover:shadow-md ${m.role === 'user' ? 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/60 dark:to-amber-900/30 text-amber-950 dark:text-amber-100 rounded-tr-none max-w-[85%] border border-amber-200/50 dark:border-amber-800/30' : 'bg-white/90 dark:bg-[#1c1917]/90 backdrop-blur-sm text-amber-900 dark:text-amber-50 border border-amber-100 dark:border-amber-900/50 rounded-tl-none max-w-[95%]'}`}>
        {m.role === 'assistant' && (m.groundingMetadata || m.thought) && (
          <div className="absolute -top-2 -left-2 flex gap-1 z-10">
            {m.groundingMetadata && (
              <motion.div 
                initial={{ scale: 0, rotate: -20 }} 
                animate={{ scale: 1, rotate: 0 }}
                className="bg-emerald-600 text-white p-1.5 rounded-xl border-2 border-white dark:border-[#1c1917] shadow-lg flex items-center gap-1" 
                title="تم التحقق عبر بحث غوغل"
              >
                <Globe size={10} />
                <span className="text-[8px] font-bold">بحث</span>
              </motion.div>
            )}
            {m.thought && (
              <motion.div 
                initial={{ scale: 0, rotate: 20 }} 
                animate={{ scale: 1, rotate: 0 }}
                className="bg-amber-600 text-white p-1.5 rounded-xl border-2 border-white dark:border-[#1c1917] shadow-lg flex items-center gap-1" 
                title="تأمل عميق مفعل"
              >
                <Brain size={10} />
                <span className="text-[8px] font-bold">تأمل</span>
              </motion.div>
            )}
          </div>
        )}
        
        {m.role === 'assistant' && m.thought && (
          <div className="mb-4 p-3 bg-amber-50/30 dark:bg-amber-950/20 border-r-2 border-amber-400/50 dark:border-amber-600/50 rounded-lg text-[13px] italic text-amber-800/70 dark:text-amber-300/60 font-sans shadow-inner" dir="rtl">
            <div className="flex items-center gap-1.5 mb-2 font-bold not-italic text-amber-700/80 dark:text-amber-400/80">
              <Brain size={14} className="animate-pulse" />
              <span>تأملات عميقة...</span>
            </div>
            <div className="opacity-80">
              <ReactMarkdown>{m.thought}</ReactMarkdown>
            </div>
          </div>
        )}

        {m.attachments && m.attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 my-2 max-w-2xl" dir="rtl">
            {m.attachments.map((att, attIdx) => (
              <div key={attIdx} className="p-2 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 rounded-xl overflow-hidden max-w-[280px] flex-shrink-0">
                {att.mimeType.startsWith('image/') ? (
                  <img 
                    src={`data:${att.mimeType};base64,${att.data}`} 
                    alt={att.filename || 'مرفق صورة'} 
                    className="max-h-40 w-auto rounded-lg object-contain shadow-sm mx-auto border border-amber-200/40"
                  />
                ) : att.mimeType.startsWith('video/') ? (
                  <video 
                    src={`data:${att.mimeType};base64,${att.data}`} 
                    controls 
                    className="max-h-40 w-full rounded-lg shadow-sm"
                  />
                ) : att.mimeType.startsWith('audio/') ? (
                  <audio 
                    src={`data:${att.mimeType};base64,${att.data}`} 
                    controls 
                    className="max-h-16 w-full rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 font-sans p-1">
                    <span className="text-base">📎</span>
                    <span className="truncate font-medium max-w-[200px]">{att.filename || 'ملف مرفق'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : m.inlineData ? (
          <div className="my-2 p-2 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 rounded-xl overflow-hidden max-w-sm" dir="rtl">
            {m.inlineData.mimeType.startsWith('image/') ? (
              <img 
                src={`data:${m.inlineData.mimeType};base64,${m.inlineData.data}`} 
                alt={m.inlineData.filename || 'مرفق صورة'} 
                className="max-h-60 w-auto rounded-lg object-contain shadow-sm"
              />
            ) : m.inlineData.mimeType.startsWith('video/') ? (
              <video 
                src={`data:${m.inlineData.mimeType};base64,${m.inlineData.data}`} 
                controls 
                className="max-h-60 w-full rounded-lg shadow-sm"
              />
            ) : m.inlineData.mimeType.startsWith('audio/') ? (
              <audio 
                src={`data:${m.inlineData.mimeType};base64,${m.inlineData.data}`} 
                controls 
                className="max-h-16 w-full rounded-lg shadow-sm"
              />
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 font-sans p-1">
                <span className="text-base">📎</span>
                <span className="truncate font-medium">{m.inlineData.filename || 'ملف مرفق'}</span>
              </div>
            )}
          </div>
        ) : null}

        {(() => {
          const rawText = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          return (
            <div className="prose dark:prose-invert prose-amber max-w-none leading-relaxed text-right font-sans message-bubble" dir="rtl">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                rehypePlugins={[rehypeRaw]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeStr = String(children).replace(/\n$/, '');
                    const lang = match ? match[1].toLowerCase() : '';

                    const lowerCode = codeStr.toLowerCase();
                    const unescapedLowerCode = lowerCode
                      .replace(/&amp;/g, '&')
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'")
                      .replace(/&apos;/g, "'");

                    const isHtmlLike = lang === 'html' || 
                                       lang === 'svg' || 
                                       lang === 'xml' || 
                                       (!inline && (
                                         unescapedLowerCode.includes('<div') ||
                                         unescapedLowerCode.includes('</div>') ||
                                         unescapedLowerCode.includes('<span') ||
                                         unescapedLowerCode.includes('</span>') ||
                                         unescapedLowerCode.includes('<style') ||
                                         unescapedLowerCode.includes('</style>') ||
                                         unescapedLowerCode.includes('<svg') ||
                                         unescapedLowerCode.includes('</svg>') ||
                                         unescapedLowerCode.includes('<ul') ||
                                         unescapedLowerCode.includes('</ul>') ||
                                         unescapedLowerCode.includes('<li') ||
                                         unescapedLowerCode.includes('</li>') ||
                                         unescapedLowerCode.includes('<p') ||
                                         unescapedLowerCode.includes('</p>') ||
                                         unescapedLowerCode.includes('style=') ||
                                         unescapedLowerCode.includes('class=') ||
                                         (unescapedLowerCode.trim().startsWith('<') && unescapedLowerCode.trim().includes('>'))
                                       ));

                    if (!inline && isHtmlLike) {
                      return <HtmlPreviewBlock code={codeStr} />;
                    }

                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {rawText}
              </ReactMarkdown>
            </div>
          );
        })()}

        {m.role === 'assistant' && (
          <div className="flex items-center gap-2 mt-2 text-[9px] text-amber-600/60 dark:text-amber-400/60 font-mono" dir="ltr">
            <Cpu size={8} /> {selectedModel.split('|')[1] || selectedModel}
            <Brain size={8} /> {providerName}
          </div>
        )}

        {m.imageUrl && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-amber-100/50 dark:border-amber-900/40 shadow-sm group/img relative bg-amber-50/50 dark:bg-black/20 min-h-[200px] flex flex-col items-center justify-center">
            {!imgLoaded && !imgError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-50/80 to-amber-100/50 dark:from-zinc-900 dark:to-zinc-800 animate-pulse">
                <Loader2 className="w-8 h-8 text-amber-600 dark:text-amber-400 animate-spin" />
                <span className="text-xs text-amber-800/60 dark:text-amber-200/60 font-sans">تجلّي الصورة الروحية...</span>
              </div>
            )}
            {imgError ? (
              <div className="p-4 text-center flex flex-col items-center gap-2 text-amber-800/60 dark:text-amber-200/60">
                <ImageIcon size={32} className="opacity-50" />
                <span className="text-xs font-sans">تعذر تحميل الصورة المعبرة</span>
              </div>
            ) : (
              <img 
                src={localImageUrl || m.imageUrl} 
                alt="صورة روحية معبرة" 
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                className={`w-full max-h-[400px] object-cover transition-all duration-700 ${imgLoaded ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                referrerPolicy="no-referrer"
              />
            )}
            {imgLoaded && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
                <span className="text-white text-xs font-sans font-medium">صورة مستوحاة من فيض المعنى</span>
                <a 
                  href={localImageUrl || m.imageUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="p-1 rounded-lg bg-white/20 hover:bg-white/40 text-white transition-colors"
                  title="فتح الصورة بحجم كامل"
                >
                  <Maximize2 size={14} />
                </a>
              </div>
            )}
            <div className="absolute bottom-1 right-1 text-[8px] text-white/50 bg-black/30 px-1 rounded-sm" dir="ltr">
              Generated by {m.imageModel || providerName} ({selectedModel.split('|')[1] || selectedModel})
            </div>
          </div>
        )}
        
        <div className={`flex flex-wrap items-center gap-1 mt-4 pt-3 border-t border-amber-100/50 dark:border-amber-900/30 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className="flex flex-wrap items-center bg-amber-50/80 dark:bg-black/20 rounded-2xl px-2 py-1.5 border border-amber-100/50 dark:border-white/5 backdrop-blur-md gap-1 shadow-sm">
            {m.role === 'user' && (
              <button 
                onClick={() => onEdit(index)} 
                className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105"
                title="تعديل الرسالة"
              >
                <Edit2 size={16} />
              </button>
            )}
            
            {m.role === 'assistant' && (
              <button 
                onClick={() => onRegenerate(index)} 
                className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105"
                title="إعادة توليد"
              >
                <RefreshCw size={16} />
              </button>
            )}

            <button 
              onClick={() => copyToClipboard(m.content, index.toString())} 
              className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105 flex items-center gap-1.5" 
              title="نسخ النص"
            >
              {copyFeedback === index.toString() ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
            
            <button 
              onClick={() => shareMessage(m.content)} 
              className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105 flex items-center gap-1.5" 
              title="مشاركة"
            >
              <Share2 size={16} />
            </button>

            {m.role === 'assistant' && (
              <>
                <div className="w-px h-4 bg-amber-200 dark:bg-amber-800 mx-1"></div>
                
                <button 
                  onClick={() => isGeneratingAudio === index.toString() ? stopRecitation() : handleAIRecitation(m.content, index)} 
                  className={`p-2 rounded-xl transition-all hover:scale-105 flex items-center gap-1.5 overflow-hidden ${isGeneratingAudio === index.toString() ? 'bg-amber-600 text-white animate-pulse shadow-md shadow-amber-600/20' : 'hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400'}`}
                  title="تلاوة احترافية (مداد)"
                >
                  {isGeneratingAudio === index.toString() ? <StopCircle size={16} /> : <Volume2 size={16} />}
                </button>

                {audioUrl && (
                  <button 
                    onClick={() => downloadAudioFile(audioUrl, `midad_recitation_${index}`)}
                    className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105 flex items-center gap-1.5"
                    title="تنزيل التلاوة"
                  >
                    <Download size={16} />
                  </button>
                )}

                <div className="w-px h-4 bg-amber-200 dark:bg-amber-800 mx-1"></div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => sendMessage(`واصل المدد في هذه النقطة بالتحديد: ${m.content.substring(0, 500)}...`)}
                    className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105"
                    title="واصل المدد"
                  >
                    <Sparkles size={16} />
                  </button>
                  <button 
                    onClick={() => sendMessage(`لخص لي هذه الرسالة بأسلوب بسيط وميسر: ${m.content.substring(0, 500)}...`)}
                    className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105"
                    title="تبسيط المعنى"
                  >
                    <Zap size={16} />
                  </button>
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('open_spiritual_vision', { detail: { text: m.content } }))}
                    className="p-2 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 text-amber-700 dark:text-amber-400 transition-all hover:scale-105" 
                    title="رؤية بصرية"
                  >
                    <ImageIcon size={16} />
                  </button>
                </div>
              </>
            )}

            <div className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-800/80 transition-all hover:scale-105 ml-1">
              <AdvancedReadAloud 
                text={m.content} 
                voiceName={selectedVoice}
                className="gap-1.5"
                buttonClassName="p-1 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {m.role === 'assistant' && (() => {
        const navDetails = extractQuranNavigationDetails(m.content);
        if (!navDetails) return null;
        return (
          <motion.div 
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 w-full max-w-[95%] bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-emerald-500/10 dark:from-amber-900/40 dark:via-amber-800/40 dark:to-emerald-950/40 border border-amber-400/40 dark:border-amber-700/60 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-3"
            dir="rtl"
          >
            <div className="flex items-center gap-2.5 text-amber-950 dark:text-amber-100">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <Book size={18} />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">الانتقال التفاعلي للمصحف الشريف</span>
                <span className="text-sm font-bold text-amber-950 dark:text-amber-100">
                  {navDetails.surah ? `سورة ${navDetails.surah}` : ''} {navDetails.ayah ? `- الآية ${navDetails.ayah}` : ''} {navDetails.page ? `(صفحة ${navDetails.page})` : ''}
                </span>
              </div>
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate_quran', { detail: navDetails }))}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1 shrink-0"
            >
              <span>افتح المصحف</span>
              <ChevronRight size={16} />
            </button>
          </motion.div>
        );
      })()}

      {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 w-full max-w-[95%] bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 rounded-2xl p-3 shadow-sm"
          dir="rtl"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
            <Sparkles size={14} className="text-amber-500 animate-pulse" />
            <span>محاور وأسئلة لإثراء الحوار وإدامة التدبر:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {m.suggestions.map((sug, sIdx) => (
              <button
                key={sIdx}
                onClick={() => sendMessage(sug)}
                className="text-xs bg-white dark:bg-stone-900 hover:bg-amber-600 hover:text-white dark:hover:bg-amber-600 text-amber-950 dark:text-amber-100 border border-amber-200/60 dark:border-amber-800/60 rounded-xl px-3 py-1.5 transition-all duration-200 shadow-sm hover:shadow active:scale-95 text-right font-medium"
              >
                {sug}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {m.role === 'assistant' && m.groundingMetadata && (() => {
        const chunks = m.groundingMetadata.groundingChunks || [];
        const sources = chunks.map((c: any) => ({
          title: c.web?.title || c.title || 'مصدر ويب',
          uri: c.web?.uri || c.uri || ''
        })).filter((s: any) => s.uri);

        const queries = m.groundingMetadata.webSearchQueries || [];
        if (sources.length === 0 && queries.length === 0) return null;

        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 w-full max-w-[95%] bg-amber-50/40 dark:bg-amber-900/5 backdrop-blur-md rounded-2xl border border-amber-200/30 dark:border-amber-800/20 overflow-hidden shadow-sm p-4" 
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-200/30 dark:border-amber-800/20">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100 font-bold text-sm">
                <Globe size={16} className="text-emerald-600" />
                <span>المصادر والمراجع الموثقة</span>
              </div>
            </div>

            {queries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-[10px] text-amber-700/60 dark:text-amber-400/60 font-medium">عمليات البحث:</span>
                {queries.map((q: string, idx: number) => (
                  <span key={idx} className="bg-amber-100/50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full text-[10px] text-amber-800 dark:text-amber-300 border border-amber-200/30 dark:border-amber-800/20">
                    {q}
                  </span>
                ))}
              </div>
            )}

            {sources.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sources.map((src: any, idx: number) => {
                  const cleanTitle = src.title.length > 75 ? src.title.substring(0, 72) + '...' : src.title;
                  let domain = '';
                  try {
                    domain = new URL(src.uri).hostname.replace('www.', '');
                  } catch (e) {}

                  return (
                    <a
                      key={idx}
                      href={src.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 p-2.5 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all border border-amber-100/40 dark:border-amber-900/20 hover:border-emerald-300 dark:hover:border-emerald-800 group/link shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    >
                      <div className="flex items-center justify-center text-[11px] w-6 h-6 bg-emerald-600 text-white rounded-lg shrink-0 font-bold shadow-md shadow-emerald-900/10">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[12px] leading-tight text-amber-950 dark:text-amber-50 group-hover/link:text-emerald-700 dark:group-hover/link:text-emerald-400 transition-colors text-right">
                          {cleanTitle}
                        </div>
                        {domain && (
                          <div className="text-[9px] text-amber-800/50 dark:text-amber-400/50 font-mono mt-1 text-right">
                            {domain}
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-2 text-amber-800/40 dark:text-amber-400/40 text-xs italic">
                جاري استحضار المصادر...
              </div>
            )}
          </motion.div>
        );
      })()}
    </motion.div>
  );
});
