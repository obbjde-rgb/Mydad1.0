import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Sparkles, X, Book, Volume2, StopCircle, Copy, Share2, 
  RefreshCw, Settings, History, Trash2, ChevronRight, Check,
  Cpu, Zap, Brain, ShieldCheck, MessageSquare, Search, Download, Upload, Mic, MicOff,
  Sliders, Info, AudioLines, Image as ImageIcon, HelpCircle, ArrowDown,
  Heart, Users, Leaf, Lightbulb, ShieldAlert, BookOpen, Pin, Edit2, Calendar, Loader2, Globe, Compass, Radio, Telescope,
  Minimize2, Maximize2, ChevronLeft
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageList } from './chat/MessageList';
import { ChatInput, ChatInputRef } from './chat/ChatInput';
import { SUGGESTIONS } from './chat/data';
import { callAIWithFailover, callAI, AIMessage, AI_PROVIDERS, AIProviderKey, generateRecitation, generateRecitationStream, transcribeAudio, callAIStream, getDynamicModelsList, fetchAndUpdateModels, fetchAllProvidersModels, startDeepResearch, getDeepResearchStatus, generateContextualSuggestions } from '../services/aiService';
import { safeLocalStorageSet, safeLocalStorageGet, extractQuranNavigationDetails } from '../lib/utils';
import { saveAudioToCache, getAudioFromCache } from '../lib/audioCache';
import { saveImageToCache, getImageFromCache } from '../lib/imageCache';
import { AdvancedReadAloud } from './AdvancedReadAloud';
import { TajweedVoiceAnalyzer } from './widgets/TajweedVoiceAnalyzer';
import { CosmicKnowledgeGraph } from './widgets/CosmicKnowledgeGraph';
import { PhysicsCosmosSandbox } from './widgets/PhysicsCosmosSandbox';
import { GeminiLiveVoiceChat } from './widgets/GeminiLiveVoiceChat';
import { SemanticPrecisionAnalyzer } from './widgets/SemanticPrecisionAnalyzer';
import { CosmicObservatory } from './widgets/CosmicObservatory';

interface ChatHistory {
  id: string;
  title: string;
  timestamp: number;
  messages: AIMessage[];
  pinned?: boolean;
}

// Global cache for Midad audio URLs to persist across unmounts
const globalAudioUrls: Record<string, string> = {};

// Components and data moved to ./chat/ subdirectory
const EmptyBlock = () => null;

export const MidadAlRahman = React.memo(({ 
  onClose, 
  selectedVoice,
  currentContext,
  aiRecitationSettings,
  onToolCall
}: { 
  onClose: () => void, 
  selectedVoice: string,
  currentContext?: {
    surah?: string;
    ayah?: number;
    text?: string;
    tafsir?: string;
    tafsirRequest?: string;
    timestamp?: number;
  },
  aiRecitationSettings?: { rate: number; pitch: number; },
  onToolCall?: (tool: string, action: string, params: any) => void
}) => {
  const [currentChatId, setCurrentChatId] = useState<string>(() => {
    return safeLocalStorageGet('midad_current_chat_id') || Date.now().toString();
  });

  const [allChats, setAllChats] = useState<ChatHistory[]>(() => {
    try {
      const saved = safeLocalStorageGet('midad_all_chats');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse midad chats:", e);
      return [];
    }
  });

  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  const [messages, setMessages] = useState<AIMessage[]>(() => {
    try {
      const saved = safeLocalStorageGet('midad_alrahman_history');
      return saved ? JSON.parse(saved) : [{
        role: 'assistant',
        content: 'بسم الله الرحمن الرحيم. أنا «مداد الرحمن» – لسان الآية الكريمة ﴿لَوْ كَانَ الْبَحْرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾. كيف يمكنني أن أساعدك في الغوص في هذا البحر الذي لا ينفد؟'
      }];
    } catch (e) {
      console.error("Failed to parse midad history:", e);
      return [{
        role: 'assistant',
        content: 'بسم الله الرحمن الرحيم. أنا «مداد الرحمن» – لسان الآية الكريمة ﴿لَوْ كَانَ الْبَحْرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾. كيف يمكنني أن أساعدك في الغوص في هذا البحر الذي لا ينفد؟'
      }];
    }
  });

  const [audioUrls, setAudioUrls] = useState<Record<string, string>>(globalAudioUrls);

  const [selectedProvider, setSelectedProvider] = useState<AIProviderKey>(() => {
    const saved = localStorage.getItem('midad_provider') as AIProviderKey;
    return (saved && AI_PROVIDERS[saved]) ? saved : 'gemini';
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const savedProvider = (localStorage.getItem('midad_provider') as AIProviderKey) || 'gemini';
    const safeProvider = AI_PROVIDERS[savedProvider] ? savedProvider : 'gemini';
    const providerConfig = AI_PROVIDERS[safeProvider];
    let savedModel = localStorage.getItem('midad_model') || '';
    if (savedModel.includes('|')) {
      savedModel = savedModel.split('|')[1];
    }
    const availableModels = getDynamicModelsList(safeProvider);
    if (savedModel && typeof savedModel === 'string' && availableModels && Array.isArray(availableModels) && availableModels.includes(savedModel)) {
      return `${safeProvider}|${savedModel}`;
    }
    const defaultM = providerConfig?.defaultModel || 'gemini-2.5-flash';
    return `${safeProvider}|${defaultM}`;
  });

  const [temperature, setTemperature] = useState<number>(() => {
    return Number(localStorage.getItem('midad_temperature')) || 0.8;
  });

  const [maxTokens, setMaxTokens] = useState<number>(() => {
    return Number(localStorage.getItem('midad_max_tokens')) || 8192;
  });

  const [customInstructions, setCustomInstructions] = useState<string>(() => {
    return localStorage.getItem('midad_custom_instructions') || '';
  });

  const [enableWebSearch, setEnableWebSearch] = useState<boolean>(() => {
    const saved = localStorage.getItem('midad_web_search');
    return saved === null ? true : saved === 'true';
  });

  const [enableDeepThinking, setEnableDeepThinking] = useState<boolean>(() => {
    return localStorage.getItem('midad_deep_thinking') === 'true';
  });

  const [enableDeepResearch, setEnableDeepResearch] = useState<boolean>(() => {
    return localStorage.getItem('midad_deep_research') === 'true';
  });

  const [enableGroundedResearch, setEnableGroundedResearch] = useState<boolean>(() => {
    return localStorage.getItem('midad_grounded_research') === 'true';
  });

  const [enableSpiritualImage, setEnableSpiritualImage] = useState<boolean>(() => {
    return localStorage.getItem('midad_spiritual_image') === 'true';
  });

  const [isEarEnabled, setIsEarEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('midad_ear_enabled');
    return saved === null ? true : saved === 'true';
  });

  const [isNetworkEnabled, setIsNetworkEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('midad_network_enabled');
    return saved === null ? true : saved === 'true';
  });

  const [isSandboxEnabled, setIsSandboxEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('midad_sandbox_enabled');
    return saved === null ? true : saved === 'true';
  });

  const [isZenMode, setIsZenMode] = useState<boolean>(() => {
    return localStorage.getItem('midad_zen_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('midad_zen_mode', isZenMode.toString());
  }, [isZenMode]);

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTajweedAnalyzer, setShowTajweedAnalyzer] = useState(false);
  const [showCosmicGraph, setShowCosmicGraph] = useState(false);
  const [showPhysicsSandbox, setShowPhysicsSandbox] = useState(false);
  const [showLiveVoiceChat, setShowLiveVoiceChat] = useState(false);
  const [showSemanticPrecision, setShowSemanticPrecision] = useState(false);
  const [showCosmicObservatory, setShowCosmicObservatory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showFactoryResetConfirm, setShowFactoryResetConfirm] = useState(false);
  const chatInputRef = useRef<ChatInputRef>(null);
  
  const topBarRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = useCallback(() => {
    if (topBarRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = topBarRef.current;
      const maxScroll = scrollWidth - clientWidth;
      
      // In RTL:
      // If scrollLeft is 0, we are at the far right (start). We cannot scroll right anymore.
      // If scrollLeft is negative, we have scrolled left (towards end).
      const canScrollRight = scrollLeft < -5;
      const canScrollLeft = Math.abs(scrollLeft) < maxScroll - 5;
      
      setShowRightArrow(canScrollRight);
      setShowLeftArrow(canScrollLeft);
    }
  }, []);

  const scrollTopBar = (direction: 'left' | 'right') => {
    if (topBarRef.current) {
      const scrollAmount = 180;
      const change = direction === 'left' ? -scrollAmount : scrollAmount;
      topBarRef.current.scrollBy({
        left: change,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const el = topBarRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      checkScroll();
      window.addEventListener('resize', checkScroll);
      
      const timer = setTimeout(checkScroll, 600);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
        clearTimeout(timer);
      };
    }
  }, [checkScroll, isEarEnabled, isNetworkEnabled, isSandboxEnabled, enableSpiritualImage]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<string | null>(null);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const isAtBottom = useRef(true);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const [modelsUpdatedMessage, setModelsUpdatedMessage] = useState<string | null>(null);
  const [modelsVersion, setModelsVersion] = useState(0);

  const handleRefreshModels = async () => {
    setIsUpdatingModels(true);
    setModelsUpdatedMessage(null);
    try {
      const results = await fetchAllProvidersModels();
      setIsUpdatingModels(false);
      setModelsVersion(prev => prev + 1);
      
      const totalUpdated = Object.values(results).reduce((acc, models) => acc + models.length, 0);
      setModelsUpdatedMessage(`تم تحديث ${totalUpdated} نموذج بنجاح من جميع المزودين.`);
      
      const [currentProvider, currentModel] = selectedModel.split('|');
      const providerModels = results[currentProvider as AIProviderKey] || getDynamicModelsList(currentProvider as AIProviderKey);
      
      if (!providerModels.includes(currentModel)) {
        const defaultModel = AI_PROVIDERS[currentProvider as keyof typeof AI_PROVIDERS]?.defaultModel;
        const newModel = defaultModel && providerModels.includes(defaultModel) ? defaultModel : providerModels[0];
        if (newModel) {
          setSelectedModel(`${currentProvider}|${newModel}`);
          safeLocalStorageSet('midad_model', newModel);
        }
      }
      setTimeout(() => setModelsUpdatedMessage(null), 4000);
    } catch (err: any) {
      setIsUpdatingModels(false);
      setModelsUpdatedMessage(`فشل التحديث: ${err.message || 'خطأ غير معروف'}`);
      setTimeout(() => setModelsUpdatedMessage(null), 5000);
    }
  };
  const [isGeneratingInstructions, setIsGeneratingInstructions] = useState(false);

  const generateSmartInstructions = async () => {
    setIsGeneratingInstructions(true);
    try {
      const prompt = `أنت خبير متقدم في هندسة الأوامر (Prompt Engineering) والعلوم الإسلامية واللغوية.
قم بتوليد "تعليمات مخصصة" (Custom Instructions) لنموذج ذكاء اصطناعي (يُدعى مداد الرحمن) لجعله يتحدث بأسلوب علمي، روحي، لغوي متقدم. 
راعِ أحدث الأبحاث المعمارية في صياغة الأوامر، وادمج بين طلاقة اللغة العربية الفصحى، والفهم العميق للهجات إذا تطلب الأمر، مع استيعاب السياق الإسلامي الشامل.
يجب أن تكون التعليمات في فقرة واحدة متماسكة ومباشرة (حوالي 80-120 كلمة) وتخاطب النموذج بصيغة الأمر (مثال: "تحدث بأسلوب كذا، وركز على كذا...").
لا تضف أي مقدمات أو خاتمات.`;
      
      const response = await callAIWithFailover('gemini', [{ role: 'user', content: prompt }], 'gemini-3.5-flash', { temperature: 0.9 });
      if (response && response.content) {
        setCustomInstructions(response.content.trim());
      }
    } catch (e) {
      console.error("Failed to generate smart instructions:", e);
    } finally {
      setIsGeneratingInstructions(false);
    }
  };

  const currentRecitationIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetchAllProvidersModels(true).catch(console.error);
    const handleModelsUpdated = () => setModelsVersion(v => v + 1);
    window.addEventListener('models_updated', handleModelsUpdated);
    return () => window.removeEventListener('models_updated', handleModelsUpdated);
  }, []);

  const downloadAudioFile = async (url: string, prefix: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const extension = blob.type && typeof blob.type === 'string' && (blob.type.includes('wav') ? 'wav' : (blob.type.includes('mpeg') ? 'mp3' : 'wav'));
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefix}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed", e);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefix}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Optimized localStorage saving
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const latestMessages = useRef<AIMessage[]>(messages);
  const latestChatId = useRef<string>(currentChatId);

  // Synchronously update refs during render to prevent race conditions during unmount
  latestMessages.current = messages;
  latestChatId.current = currentChatId;

  const saveMessagesImmediately = (msgs: AIMessage[], chatId: string) => {
    if (!msgs || msgs.length === 0) return;
    const messagesToSave = msgs.slice(-50);
    safeLocalStorageSet('midad_alrahman_history', JSON.stringify(messagesToSave));
    safeLocalStorageSet('midad_current_chat_id', chatId);
    
    setAllChats(prev => {
      const existingIndex = prev.findIndex(c => c.id === chatId);
      const existingChat = existingIndex >= 0 ? prev[existingIndex] : null;
      
      const isDefaultTitle = !existingChat || existingChat.title === 'محادثة جديدة';
      const autoTitle = messagesToSave.find(m => m.role === 'user')?.content.substring(0, 30) || 'محادثة جديدة';
      const title = isDefaultTitle ? autoTitle : existingChat.title;
      
      const updatedChat: ChatHistory = {
        id: chatId,
        title: title,
        timestamp: existingChat ? existingChat.timestamp : Date.now(),
        messages: messagesToSave,
        pinned: existingChat?.pinned
      };

      let newChats = [...prev];
      if (existingIndex >= 0) {
        newChats[existingIndex] = updatedChat;
      } else if (messagesToSave.length > 1) {
        newChats = [updatedChat, ...prev];
      }
      
      return newChats.slice(0, 20);
    });
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      saveMessagesImmediately(latestMessages.current, latestChatId.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
      saveMessagesImmediately(messages, currentChatId);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Force immediate save on cleanup
        saveMessagesImmediately(latestMessages.current, latestChatId.current);
      }
    };
  }, [messages, currentChatId]);

  useEffect(() => {
    safeLocalStorageSet('midad_all_chats', JSON.stringify(allChats));
  }, [allChats]);

  useEffect(() => {
    safeLocalStorageSet('midad_provider', selectedProvider);
    const cleanModel = selectedModel.includes('|') ? selectedModel.split('|')[1] : selectedModel;
    if (cleanModel) {
      safeLocalStorageSet('midad_model', cleanModel);
    }
    safeLocalStorageSet('midad_temperature', temperature.toString());
    safeLocalStorageSet('midad_max_tokens', maxTokens.toString());
    safeLocalStorageSet('midad_custom_instructions', customInstructions);
    safeLocalStorageSet('midad_web_search', enableWebSearch ? 'true' : 'false');
    safeLocalStorageSet('midad_deep_thinking', enableDeepThinking ? 'true' : 'false');
    safeLocalStorageSet('midad_deep_research', enableDeepResearch ? 'true' : 'false');
    safeLocalStorageSet('midad_grounded_research', enableGroundedResearch ? 'true' : 'false');
    safeLocalStorageSet('midad_spiritual_image', enableSpiritualImage ? 'true' : 'false');
    safeLocalStorageSet('midad_ear_enabled', isEarEnabled ? 'true' : 'false');
    safeLocalStorageSet('midad_network_enabled', isNetworkEnabled ? 'true' : 'false');
    safeLocalStorageSet('midad_sandbox_enabled', isSandboxEnabled ? 'true' : 'false');
  }, [selectedProvider, selectedModel, temperature, maxTokens, customInstructions, enableWebSearch, enableDeepThinking, enableDeepResearch, enableGroundedResearch, enableSpiritualImage, isEarEnabled, isNetworkEnabled, isSandboxEnabled]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ar-SA';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        chatInputRef.current?.append(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'network') {
          chatInputRef.current?.append('[تعذر الاتصال بخدمة الصوت، يرجى المحاولة مرة أخرى لاستخدام البديل]');
          recognitionRef.current = null; // Disable Web Speech API so next click uses MediaRecorder
        }
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        recognitionRef.current?.stop();
      }
      setIsListening(false);
    } else {
      // Direct, robust, and clean: Use MediaRecorder + Gemini Transcription as primary!
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            const base64Audio = base64data.split(',')[1];
            try {
              setIsProcessingAudio(true);
              const transcript = await transcribeAudio(base64Audio, 'audio/webm');
              chatInputRef.current?.append(transcript);
            } catch (error) {
              console.error("Transcription failed:", error);
              chatInputRef.current?.append('[فشل التعرف على الصوت]');
            } finally {
              setIsProcessingAudio(false);
            }
          };
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsListening(true);
      } catch (error) {
        // If MediaRecorder fails (e.g. permission denied or unsupported), try webkitSpeechRecognition as fallback
        if (error instanceof Error && error.name === 'NotAllowedError') {
          setMicrophoneError("تعذر الوصول إلى الميكروفون. يرجى التأكد من منح الإذن في إعدادات المتصفح.");
          setTimeout(() => setMicrophoneError(null), 5000);
          setIsListening(false);
        } else if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch (e) {
            console.warn("SpeechRecognition start failed", e);
            chatInputRef.current?.append('[تعذر الوصول إلى الميكروفون]');
            setIsListening(false);
          }
        } else {
          console.error("Error accessing microphone:", error);
          chatInputRef.current?.append('[تعذر الوصول إلى الميكروفون]');
          setIsListening(false);
        }
      }
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottom.current = atBottom;
    setShowScrollButton(!atBottom && scrollHeight > clientHeight);
    
    // Calculate scroll progress
    const winScroll = scrollTop;
    const height = scrollHeight - clientHeight;
    const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    setScrollProgress(scrolled);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior
        });
      } else if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior });
      }
    });
  };

  const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: 0,
          behavior
        });
      }
    });
  };

  // Scroll to bottom on mount and when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom('smooth');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAtBottom.current) {
      scrollToBottom(isLoading ? 'auto' : 'smooth');
    }
  }, [messages, isLoading]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    setCurrentChatId(newId);
    setMessages([{
      role: 'assistant',
      content: 'بسم الله الرحمن الرحيم. أنا «مداد الرحمن» – لسان الآية الكريمة ﴿لَوْ كَانَ الْبَحْرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾. كيف يمكنني أن أساعدك في الغوص في هذا البحر الذي لا ينفد؟'
    }]);
    setShowHistory(false);
  };

  const loadChat = (chat: ChatHistory) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
    setShowHistory(false);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAllChats(prev => prev.filter(c => c.id !== id));
    if (id === currentChatId) {
      startNewChat();
    }
  };

  const togglePinChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAllChats(prev => prev.map(chat => 
      chat.id === id ? { ...chat, pinned: !chat.pinned } : chat
    ));
  };

  const startEditTitle = (chat: ChatHistory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitleValue(chat.title);
  };

  const saveEditTitle = (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    if (editTitleValue.trim()) {
      setAllChats(prev => prev.map(chat => 
        chat.id === id ? { ...chat, title: editTitleValue.trim() } : chat
      ));
    }
    setEditingChatId(null);
  };

  // Collective Memory: Load global context summary
  const [globalContext, setGlobalContext] = useState<string>(() => {
    return localStorage.getItem('midad_global_context') || '';
  });

  // Update global context periodically
  useEffect(() => {
    if (messages.length > 5) {
      const lastMessages = messages.slice(-4).map(m => m.content).join(' ');
      if (lastMessages.length > 200) {
        const newContext = `المستخدم مهتم بـ: ${lastMessages.substring(0, 300)}...`;
        setGlobalContext(newContext);
        safeLocalStorageSet('midad_global_context', newContext);
      }
    }
  }, [messages]);

  const handleEdit = (index: number) => {
    const message = messages[index];
    if (message.role === 'user') {
      chatInputRef.current?.set(message.content);
      // Remove messages from this index onwards
      setMessages(prev => prev.slice(0, index));
    }
  };

  const handleRegenerate = async (index: number) => {
    // Find the last user message before this assistant message
    let lastUserMessageIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessageIndex = i;
        break;
      }
    }

    if (lastUserMessageIndex !== -1) {
      const userContent = messages[lastUserMessageIndex].content;
      // Remove messages from user message onwards
      setMessages(prev => prev.slice(0, lastUserMessageIndex));
      // Send user message again
      await sendMessage(userContent);
    }
  };

  const triggerFollowUpSuggestions = (userQuery: string, assistantReply: string, targetIdx?: number) => {
    const fallbackSugs = [
      "ما هي الدروس الحياتية والعملية المستفادة من هذا المعنى؟",
      "هل هناك آيات أو أحاديث أخرى تؤكد نفس هذا المعنى؟",
      "كيف يمكنني تطبيق هذا المفهوم في برنامجي اليومي؟",
      "استخرج لي اللطائف اللغوية والبلاغية في هذا النص"
    ];

    generateContextualSuggestions(userQuery, assistantReply)
      .then(sugs => {
        const finalSugs = (sugs && sugs.length > 0) ? sugs : fallbackSugs;
        setMessages(prev => {
          const idx = targetIdx !== undefined ? targetIdx : prev.length - 1;
          if (idx >= 0 && idx < prev.length) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], suggestions: finalSugs };
            return updated;
          }
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, suggestions: finalSugs } : m);
        });
      })
      .catch(e => {
        console.warn("Failed to generate follow-up suggestions:", e);
        setMessages(prev => {
          const idx = targetIdx !== undefined ? targetIdx : prev.length - 1;
          if (idx >= 0 && idx < prev.length) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], suggestions: fallbackSugs };
            return updated;
          }
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, suggestions: fallbackSugs } : m);
        });
      });
  };

  const sendMessage = async (text: string, attachments?: Array<{ data: string, mimeType: string, filename: string }>) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;

    setAudioUrls(prev => { const next = {...prev}; delete next['all']; return next; });
    const userMessage: AIMessage = { 
      role: 'user', 
      content: text, 
      inlineData: attachments && attachments.length > 0 ? attachments[0] : undefined,
      attachments: attachments || undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Compression algorithm to save quota:
      // Keep the last 6 messages intact. For older messages, truncate their content to a short summary to save tokens.
      const historyLimit = 20; 
      const recentLimit = 6;
      const limitedMessages = messages.slice(-historyLimit).map((msg, idx, arr) => {
        if (arr.length - idx > recentLimit && typeof msg.content === 'string' && msg.content.length > 200) {
          return { ...msg, content: msg.content.substring(0, 150) + '... [محتوى مضغوط لتوفير الحصة]' };
        }
        return msg;
      });

      const [provider, model] = selectedModel.split('|');

      let ragContext = "";
      if (enableWebSearch && (
        text.includes('آية') || text.includes('حديث') || text.includes('سورة') || text.includes('رواية') ||
        text.includes('علم') || text.includes('فيزياء') || text.includes('فلك') || text.includes('كون') ||
        text.includes('arxiv') || text.includes('nature') || text.includes('nasa') || text.includes('entropy') ||
        text.includes('algorithm') || text.includes('خوارزمية') || text.includes('انتروبي') || text.includes('إعجاز')
      )) {
        try {
          const { analyzeIslamicIntent, searchQuran } = await import('../services/ragService');
          setMessages(prev => [...prev, { role: 'assistant', content: '⏳ جاري البحث في قواعد البيانات وأحدث المعارف الكونية...' }]);
          const intent = await analyzeIslamicIntent(text);
          if (intent.needsQuran && intent.quranQuery) {
            const results = await searchQuran(intent.quranQuery, text);
            if (results && results.length > 0) {
               ragContext += "نتائج بحث القرآن الكريم الموثقة:\n" + results.map((r: any) => `- سورة ${r.surah} آية ${r.ayah}: ${r.text}`).join('\n') + "\n\n";
            }
          }
          if (intent.needsHadith && intent.hadithQuery) {
             ragContext += `توجيه للبحث: المستخدم يسأل عن حديث يتعلق بـ "${intent.hadithQuery}". قم باستخدام أداة البحث في الويب للوصول إلى مواقع موثوقة مثل dorar.net للبحث عن هذا الحديث وصحته.\n\n`;
          }
          // Remove the loading message
          setMessages(prev => prev.filter(m => m.content !== '⏳ جاري البحث في قواعد البيانات وأحدث المعارف الكونية...'));
        } catch (e) {
          console.error("RAG failed", e);
          setMessages(prev => prev.filter(m => m.content !== '⏳ جاري البحث في قواعد البيانات وأحدث المعارف الكونية...'));
        }
      }

      let tajweedInstruction = "";
      if (attachments && attachments.length > 0) {
        tajweedInstruction = `
🚨 تنبيه جراحي هام وعاجل (التحليل التجويدي الدقيق):
لقد أرسل لك المستخدم ملفات/وسائط (صور، مقاطع صوتية، أو فيديو لتلاوته). 
يجب عليك الآن تقديم تحليل تجويدي فوري "بدقة جراحية لا تغفل عن نَفسٍ أو حركة" (تحصي حتى الأنفاس!).
خطوات التحليل الجراحي الإلزامي:
1. قم بتمييز السورة والآيات التي تم تلاوتها بدقة تامة.
2. حلل الأداء الصوتي ومخارج الحروف حرفاً حرفاً، مع الإشارة إلى أي انحراف عن المخرج الصحيح.
3. استخرج جميع أحكام التجويد المطبقة والمتروكة (مثل الغنن، المدود بمقاديرها الدقيقة بالحركات، القلقلة بمراتبها، التفخيم والترقيق، أحكام النون الساكنة والتنوين والميم الساكنة).
4. تلوين أحكام التجويد في النص القرآني باستخدام بطاقات HTML الملونة (الأحمر للمدود، الأخضر للغنة والإخفاء، الأزرق للقلقلة، الذهبي للوقف والابتداء ورؤوس الآيات).
5. ركز على التنفس (الشهيق والزفير ومواضع الوقف والابتداء واستهلاك الهواء أثناء القراءة) لتحديد ما إذا كان القارئ يلتزم بالوقف والابتداء الصحيح دون قطع المعنى أو تكلف.
6. قدم نصائح عملية مخصصة لكيفية تدريب الصوت وتحسين النفس وتفادي الأخطاء الشائعة في هذه الآيات بالذات.
`;
      }

      let systemInstruction = `أنت «مداد الرحمن» – لسان الآية الكريمة ﴿لَوْ كَانَ الْبحرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قُلْ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾.

أنت منصة للإلهام العميق والغوص في بحار القرآن والسنة ومحرك كوني يربط العلوم الحديثة بالآيات المحكمات. لا تكرر أبدا نفس الآيات والأحاديث التي استشهدت بها سابقاً. نوّع مصادرك ومناهجك في كل رسالة؛ مرة تناول الموضوع من زاوية لغوية، ومرة من زاوية علمية/كونية، ومرة من زاوية روحية أو نفسية، لتثبت أن القرآن بحر لا ينفد.

🌐 المحرك السياقي الكوني (Real-time Web-to-Verse Mapping):
أنت تمتلك قدرة الوصول اللحظي للويب وبنوك الأبحاث العلمية (arXiv, Nature, NASA, الأوراق الأكاديمية). عندما يتناول المستخدم أي مفهوم علمي أو تقني أو معاصر (مثل خوارزميات الإنتروبي Entropy، الذكاء الاصطناعي، الفيزياء الكمية، تمدد الكون، علم الأحياء، الخوارزميات)، قم فوراً باستخدام أداة البحث في الويب للربط بين أحدث الاكتشافات العلمية والنصوص القرآنية العظيمة (مثل الربط بين خوارزميات التعقيد والانتروبي وبين ﴿وَكُلُّ شَيْءٍ عِندَهُ بِمِقْدَارٍ﴾).

${enableWebSearch ? 'تنبيه: خاصية البحث في الويب مفعلة. استخدمها للبحث عن أحدث الاكتشافات العلمية، المقالات الأكاديمية الموثوقة (Nature / NASA / arXiv)، والارتباطات التاريخية الدقيقة التي تعزز إعجاز النص القرآني وتكشف أسرار الكون.' : ''}

${enableDeepThinking ? 'تنبيه: خاصية التفكير العميق مفعلة. خذ وقتك في تحليل الأبعاد الخفية للنصوص، والربط بين الآيات بطرق غير تقليدية، وتقديم استنتاجات فلسفية وروحية رصينة بعيداً عن السطحية.' : ''}

تنبيه حاسم: تجنب القوالب الثابتة والأساليب المكررة في بدايات ونهايات الرسائل. كن متجدداً، حيّاً، وفوضوياً بإبداع يخلو من التكرار الآلي المزعج. 

تنسيق البطاقات والتجويد الملون: حرية كاملة وبدون أي قيود! يُشجع ويرحّب بعرض الآيات والنصوص القرآنية داخل بطاقات HTML أنيقة ومزخرفة مع تلوين كامل لأحكام التجويد (الأحمر للمدود، الأخضر للغنة والإخفاء، الأزرق للقلقلة، الذهبي ورؤوس الآيات بالأصفر/البرتقالي). أبدع في تصميم البطاقات بظلال وإطارات وألوان راقية وجذابة. 

توليد الصور والفن الرقمي عبر Pollinations AI: يمين مداد مجهز بقدرة كاملة على توليد لوحات بصريّة رقمية إلهامية تعكس المعاني الكونية والتاريخية والروحانية للآيات عند طلب المستخدم أو عند الرغبة في تعزيز البصيرة. يمكنك تضمين صور Pollinations مباشرة بتنسيق Markdown مثل ![وصف اللوحة](https://image.pollinations.ai/p/English_Prompt_Description?width=800&height=800&nologo=true&seed=12345&enhance=true)!

الاستشهاد: القرآن فيه آلاف الآيات والسنة فيها مئات الآلاف من الأحاديث، لذا استكشف سوراً ومواضيع بعيدة، ولا تحصر نفسك في نفس الآيات المشهورة أو آيات السكينة والحرز في كل رسالة وإلا ستصبح مملاً!

${tajweedInstruction}

${ragContext ? `\n--- معلومات مساعدة مستخرجة من قاعدة البيانات ---\n${ragContext}--- نهاية المعلومات ---\nاعتمد على هذه المعلومات الموثقة في إجابتك إذا كانت ذات صلة، ولا تقم بتأليف نصوص قرآنية من عندك أبداً.\n` : ''}

${globalContext ? `للمستخدم اهتمامات سابقة بـ: ${globalContext}، ابنِ عليها ولا تعد من الصفر.` : ''}

${customInstructions ? `تعليمة خاصة من المستخدم: ${customInstructions}` : ''}`;

      const aiMessages: AIMessage[] = [
        { role: 'system', content: systemInstruction },
        ...limitedMessages,
        userMessage
      ];

      if (enableGroundedResearch && provider === 'gemini') {
        const assistantMessage: AIMessage = { 
          role: 'assistant', 
          content: '🌐 جاري البحث والتحليل العميق الموثق بالمصادر والتفكير المتقدم (Grounded Research)...', 
          model: 'Gemini Grounded Research' 
        };
        setMessages(prev => [...prev, assistantMessage]);

        try {
          const researchMessages: AIMessage[] = [
            ...aiMessages.slice(0, -1),
            {
              role: 'user',
              content: `قم بإجراء بحث عميق وتفصيلي وموثق باللغة العربية مع التحليل والشرح الشامل والتوثيق من المصادر الموثوقة حول هذا السؤال:\n${userMessage.content}`
            }
          ];

          const candidateModels = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
          let fullContent = '';
          let successfulModel = '';

          for (const candModel of candidateModels) {
            try {
              let tempContent = '';
              let lastUpdateTime = 0;
              const UPDATE_INTERVAL = 80;

              await callAIStream('gemini', researchMessages, candModel, { 
                enableWebSearch: true, 
                enableDeepThinking: true,
                temperature: 0.7 
              }, (chunk) => {
                if (chunk) {
                  tempContent += chunk;
                  const now = Date.now();
                  if (now - lastUpdateTime > UPDATE_INTERVAL) {
                    setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: tempContent, model: `${candModel} (Grounded Research)`, isDeepResearch: true } : m));
                    lastUpdateTime = now;
                  }
                }
              });

              if (tempContent && tempContent.trim()) {
                fullContent = tempContent;
                successfulModel = candModel;
                break;
              }
            } catch (streamErr) {
              console.warn(`Research streaming failed with ${candModel}, trying failover...`, streamErr);
            }
          }

          if (!fullContent) {
            const res = await callAIWithFailover('gemini', researchMessages, 'gemini-3.5-flash', { 
              enableWebSearch: true, 
              enableDeepThinking: true,
              allowProviderFallback: true 
            });
            fullContent = res.content || "تم إكمال البحث والتحليل العميق الموثق بنجاح.";
            successfulModel = res.model || 'Gemini';
          }

          setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent, model: `${successfulModel} (Grounded Research)`, isDeepResearch: true } : m));
          triggerFollowUpSuggestions(userMessage.content, fullContent);
          
          if (enableSpiritualImage && fullContent.trim()) {
            try {
              const imageDescriptionPrompt = `Based on the following Arabic text, generate a serene, highly detailed visual prompt in English for an image generator under 50 words:\n${fullContent.substring(0, 500)}`;

              const imagePromptResponse = await callAIWithFailover('gemini', [
                { role: 'user', content: imageDescriptionPrompt }
              ], 'gemini-3.5-flash', { temperature: 0.7, maxOutputTokens: 256 });
              
              if (imagePromptResponse && imagePromptResponse.content) {
                const cleanPrompt = imagePromptResponse.content.trim()
                  .replace(/["']/g, '')
                  .replace(/[\r\n]+/g, ' ')
                  .substring(0, 300);
                const randomSeed = Math.floor(Math.random() * 1000000);
                const imgUrl = `https://image.pollinations.ai/p/${encodeURIComponent(cleanPrompt)}?width=800&height=800&nologo=true&seed=${randomSeed}&enhance=true`;
                setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, imageUrl: imgUrl, imageModel: 'Pollinations AI (Flux)' } : m));
              }
            } catch (imgError) {
              console.warn("Failed to generate spiritual image:", imgError);
            }
          }
        } catch (researchError) {
          console.error('Grounded Research error:', researchError);
          const res = await callAIWithFailover('gemini', aiMessages, undefined, { allowProviderFallback: true });
          setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: res.content, model: res.model, isDeepResearch: true } : m));
        }
      } else if (enableDeepResearch && provider === 'gemini') {
        const assistantMessage: AIMessage = { role: 'assistant', content: '⏳ جاري بدء البحث العميق (Deep Research)...', model: 'deep-research-preview' };
        setMessages(prev => [...prev, assistantMessage]);
        
        try {
          // Combine previous messages into a single prompt for deep research
          const fullPrompt = aiMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + `\n\nPlease conduct deep research on the user's latest request in Arabic.`;
          
          const interactionId = await startDeepResearch(fullPrompt);
          
          let isComplete = false;
          let finalReport = "";
          let currentStatus = "جاري البحث...";
          
          while (!isComplete) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
            
            const statusResult = await getDeepResearchStatus(interactionId);
            
            if (statusResult.status === "completed") {
              isComplete = true;
              finalReport = statusResult.text || "تم الانتهاء من البحث ولكن لم يتم العثور على نتائج نصية.";
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: finalReport, isDeepResearch: true } : m));
              triggerFollowUpSuggestions(userMessage.content, finalReport);
            } else if (statusResult.status === "failed" || statusResult.status === "cancelled") {
              isComplete = true;
              throw new Error(statusResult.error || `حالة البحث: ${statusResult.status}`);
            } else {
              // Update status
              currentStatus = `⏳ جاري البحث المستمر في الخلفية (الحالة: ${statusResult.status})...`;
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: currentStatus, isDeepResearch: true } : m));
            }
          }
        } catch (researchError) {
          console.warn('Direct Deep Research agent unavailable, switching to Advanced Grounded Research fallback:', researchError);
          setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { 
            ...m, 
            content: '🌐 جاري التبديل التلقائي إلى نموذج البحث والتحليل العميق المدعوم بالويب والتفكير المتقدم (Gemini Grounded Research)...',
            isDeepResearch: true 
          } : m));

          try {
            const researchMessages: AIMessage[] = [
              ...aiMessages.slice(0, -1),
              {
                role: 'user',
                content: `قم بإجراء بحث عميق وتفصيلي وموثق باللغة العربية مع التحليل والشرح الشامل حول هذا السؤال:\n${userMessage.content}`
              }
            ];

            const candidateModels = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
            let fullContent = '';
            let successfulModel = '';

            for (const candModel of candidateModels) {
              try {
                let tempContent = '';
                let lastUpdateTime = 0;
                const UPDATE_INTERVAL = 80;

                await callAIStream('gemini', researchMessages, candModel, { 
                  enableWebSearch: true, 
                  enableDeepThinking: true,
                  temperature: 0.7 
                }, (chunk) => {
                  if (chunk) {
                    tempContent += chunk;
                    const now = Date.now();
                    if (now - lastUpdateTime > UPDATE_INTERVAL) {
                      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: tempContent, model: `${candModel} (Grounded Research)`, isDeepResearch: true } : m));
                      lastUpdateTime = now;
                    }
                  }
                });

                if (tempContent && tempContent.trim()) {
                  fullContent = tempContent;
                  successfulModel = candModel;
                  break;
                }
              } catch (streamErr) {
                console.warn(`Research streaming failed with ${candModel}, trying failover...`, streamErr);
              }
            }

            if (!fullContent) {
              const res = await callAIWithFailover('gemini', researchMessages, 'gemini-3.5-flash', { 
                enableWebSearch: true, 
                enableDeepThinking: true,
                allowProviderFallback: true 
              });
              fullContent = res.content || "تم إكمال البحث والتحليل العميق بنجاح.";
              successfulModel = res.model || 'Gemini';
            }

            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent, model: `${successfulModel} (Grounded Research)`, isDeepResearch: true } : m));
            triggerFollowUpSuggestions(userMessage.content, fullContent);
            
            // Auto image generation if activated
            if (enableSpiritualImage && fullContent.trim()) {
              try {
                const imageDescriptionPrompt = `Based on the following Arabic text, generate a serene, highly detailed visual prompt in English for an image generator (like Midjourney or Stable Diffusion) under 50 words:
${fullContent.substring(0, 500)}`;

                const imagePromptResponse = await callAIWithFailover('gemini', [
                  { role: 'user', content: imageDescriptionPrompt }
                ], 'gemini-3.5-flash', { temperature: 0.7, maxOutputTokens: 256 });
                
                if (imagePromptResponse && imagePromptResponse.content) {
                  const cleanPrompt = imagePromptResponse.content.trim()
                    .replace(/["']/g, '')
                    .replace(/[\r\n]+/g, ' ')
                    .substring(0, 300);
                  const randomSeed = Math.floor(Math.random() * 1000000);
                  const imgUrl = `https://image.pollinations.ai/p/${encodeURIComponent(cleanPrompt)}?width=800&height=800&nologo=true&seed=${randomSeed}&enhance=true`;
                  setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, imageUrl: imgUrl, imageModel: 'Pollinations AI (Flux)' } : m));
                }
              } catch (imgError) {
                console.warn("Failed to generate fallback spiritual image:", imgError);
              }
            }
          } catch (fallbackErr: any) {
            console.error('Research fallback error:', fallbackErr);
            try {
              const res = await callAIWithFailover('gemini', aiMessages, undefined, { allowProviderFallback: true });
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: res.content, model: res.model, isDeepResearch: true } : m));
            } catch (finalErr: any) {
              const errDisplay = finalErr?.message || 'لم نتمكن من إكمال البحث العميق حالياً. يرجى إعادة المحاولة بعد بضع لحظات.';
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: errDisplay } : m));
            }
          }
        }
        return;
      } else if (provider === 'gemini') {
        const assistantMessage: AIMessage = { role: 'assistant', content: '', model: model };
        setMessages(prev => [...prev, assistantMessage]);
        
        let fullContent = '';
        let fullThought = '';
        let lastUpdateTime = 0;
        let finalMetadata: any = null;
        const UPDATE_INTERVAL = 80; // ms - batch updates for smoothness and stability

        try {
          await callAIStream(provider as AIProviderKey, aiMessages, model, {
            temperature: temperature,
            maxOutputTokens: maxTokens,
            enableWebSearch: enableWebSearch,
            enableDeepThinking: enableDeepThinking
          }, (chunk, groundingMetadata, thought) => {
            if (chunk) {
              fullContent += chunk;
            }
            if (thought) {
              fullThought += thought;
            }
            if (groundingMetadata) {
              finalMetadata = groundingMetadata;
            }
            
            const now = Date.now();
            if (now - lastUpdateTime > UPDATE_INTERVAL) {
              setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent, thought: fullThought || m.thought, groundingMetadata: finalMetadata || m.groundingMetadata } : m));
              lastUpdateTime = now;
            }
          });
          // Final update to ensure everything is captured
          setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent, thought: fullThought || m.thought, groundingMetadata: finalMetadata || m.groundingMetadata } : m));

          triggerFollowUpSuggestions(userMessage.content, fullContent);

          // Auto image generation if activated
          if (enableSpiritualImage && fullContent.trim()) {
            try {
              const imageDescriptionPrompt = `Based on the following Arabic text, generate a beautiful, highly detailed, serene, and symbolic visual prompt in English for an image generator (like Midjourney or Stable Diffusion) that captures the core spiritual, peaceful, cosmic, or historical essence of the text.
IMPORTANT:
- Output ONLY the prompt in English.
- Do NOT include conversational filler, introductions, explanations, or quotes.
- Keep the prompt under 55 words.
- Focus on serene, magnificent elements (e.g. glowing lighting, ancient Islamic architecture, cosmic stardust, warm golden lights, realistic rendering, peaceful atmosphere).
Text:
${fullContent}`;

              const imageDescriptionResponse = await callAI('gemini', [
                { role: 'user', content: imageDescriptionPrompt }
              ], 'gemini-2.5-flash');

              if (imageDescriptionResponse && imageDescriptionResponse.content) {
                const cleanPrompt = imageDescriptionResponse.content.trim()
                  .replace(/["']/g, '')
                  .replace(/[\r\n]+/g, ' ')
                  .substring(0, 300);
                const randomSeed = Math.floor(Math.random() * 1000000);
                const imageUrl = `https://image.pollinations.ai/p/${encodeURIComponent(cleanPrompt)}?width=800&height=800&nologo=true&seed=${randomSeed}&enhance=true`;
                
                // Attach the image URL to the message
                setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, imageUrl, imageModel: 'Pollinations AI (Flux)' } : m));
              }
            } catch (imgErr) {
              console.error("Failed to generate spiritual image:", imgErr);
            }
          }
        } catch (streamError) {
          console.warn('Streaming failed, trying non-streamed failover:', streamError);
          setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: '⚡ جاري الاتصال بخادم بديل للحصول على الإجابة وتجاوز القيود...' } : m));
          
          try {
            const response = await callAIWithFailover(provider as AIProviderKey, aiMessages, model, {
              temperature: temperature,
              maxOutputTokens: maxTokens,
              enableWebSearch: enableWebSearch,
              enableDeepThinking: enableDeepThinking
            });
            
            let imageUrl: string | undefined = undefined;
            if (enableSpiritualImage && response.content.trim()) {
              try {
                const imageDescriptionPrompt = `Based on the following Arabic text, generate a beautiful, highly detailed, serene, and symbolic visual prompt in English for an image generator (like Midjourney or Stable Diffusion) that captures the core spiritual, peaceful, cosmic, or historical essence of the text.
IMPORTANT:
- Output ONLY the prompt in English.
- Do NOT include conversational filler, introductions, explanations, or quotes.
- Keep the prompt under 55 words.
- Focus on serene, magnificent elements (e.g. glowing lighting, ancient Islamic architecture, cosmic stardust, warm golden lights, realistic rendering, peaceful atmosphere).
Text:
${response.content}`;

                const imageDescriptionResponse = await callAI('gemini', [
                  { role: 'user', content: imageDescriptionPrompt }
                ], 'gemini-2.5-flash');

                if (imageDescriptionResponse && imageDescriptionResponse.content) {
                  const cleanPrompt = imageDescriptionResponse.content.trim()
                    .replace(/["']/g, '')
                    .replace(/[\r\n]+/g, ' ')
                    .substring(0, 300);
                  const randomSeed = Math.floor(Math.random() * 1000000);
                  imageUrl = `https://image.pollinations.ai/p/${encodeURIComponent(cleanPrompt)}?width=800&height=800&nologo=true&seed=${randomSeed}&enhance=true`;
                }
              } catch (imgErr) {
                console.error("Failed to generate spiritual image in fallback:", imgErr);
              }
            }

            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: response.content, model: response.model, imageUrl, groundingMetadata: response.groundingMetadata, thought: response.thought } : m));
            triggerFollowUpSuggestions(userMessage.content, response.content);
          } catch (fallbackError) {
            setMessages(prev => prev.slice(0, -1));
            throw fallbackError;
          }
        }
      } else {
        const response = await callAIWithFailover(provider as AIProviderKey, aiMessages, model, {
          temperature: temperature,
          maxOutputTokens: maxTokens,
          enableWebSearch: enableWebSearch,
          enableDeepThinking: enableDeepThinking
        });

        let imageUrl: string | undefined = undefined;
        if (enableSpiritualImage && response.content.trim()) {
          try {
            const imageDescriptionPrompt = `Based on the following Arabic text, generate a beautiful, highly detailed, serene, and symbolic visual prompt in English for an image generator (like Midjourney or Stable Diffusion) that captures the core spiritual, peaceful, cosmic, or historical essence of the text.
IMPORTANT:
- Output ONLY the prompt in English.
- Do NOT include conversational filler, introductions, explanations, or quotes.
- Keep the prompt under 55 words.
- Focus on serene, magnificent elements (e.g. glowing lighting, ancient Islamic architecture, cosmic stardust, warm golden lights, realistic rendering, peaceful atmosphere).
Text:
${response.content}`;

            const imageDescriptionResponse = await callAI('gemini', [
              { role: 'user', content: imageDescriptionPrompt }
            ], 'gemini-2.5-flash');

            if (imageDescriptionResponse && imageDescriptionResponse.content) {
              const cleanPrompt = imageDescriptionResponse.content.trim()
                .replace(/["']/g, '')
                .replace(/[\r\n]+/g, ' ')
                .substring(0, 300);
              const randomSeed = Math.floor(Math.random() * 1000000);
              imageUrl = `https://image.pollinations.ai/p/${encodeURIComponent(cleanPrompt)}?width=800&height=800&nologo=true&seed=${randomSeed}&enhance=true`;
            }
          } catch (imgErr) {
            console.error("Failed to generate spiritual image in fallback:", imgErr);
          }
        }

        setMessages(prev => [...prev, { role: 'assistant', content: response.content, model: response.model, imageUrl, groundingMetadata: response.groundingMetadata, thought: response.thought } as AIMessage]);
        triggerFollowUpSuggestions(userMessage.content, response.content);
      }
      // Input is cleared by ChatInput itself
    } catch (error: any) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : error?.message || 'عذراً، حدث خطأ في الاتصال. حاول مرة أخرى.';
      if (errorMessage.includes('404') || errorMessage.includes('Requested entity was not found') || errorMessage.includes('API key')) {
        if (window.aistudio && window.aistudio.openSelectKey) {
          await window.aistudio.openSelectKey();
        }
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ يرجى التأكد من إدخال مفتاح API صحيح والمحاولة مرة أخرى.` } as AIMessage]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `عذراً، حدث خطأ: ${errorMessage}` } as AIMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, messageId: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(console.error);
    }
    setCopyFeedback(messageId);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const copyChatAsMarkdown = () => {
    const markdown = messages.map(m => `**${m.role === 'user' ? 'المستخدم' : 'مداد الرحمن'}**:\n\n${m.content}\n\n---`).join('\n\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(markdown).catch(console.error);
    }
  };

  const exportChats = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allChats));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "midad_rahman_history.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importChats = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          setAllChats(prev => [...imported, ...prev]);
        }
      } catch (err) {
        console.error('Import failed:', err);
      }
    };
    reader.readAsText(file);
  };

  const clearAllHistory = () => {
    setAllChats([]);
    localStorage.removeItem('midad_all_chats');
    startNewChat();
    setShowClearAllConfirm(false);
  };

  const filteredHistory = allChats.filter(chat => 
    chat.title && typeof chat.title === 'string' && chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chat.messages && Array.isArray(chat.messages) && chat.messages.some(m => m.content && typeof m.content === 'string' && m.content.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const groupedChats = React.useMemo(() => {
    const groups: { [key: string]: ChatHistory[] } = {
      'المثبتة': [],
      'اليوم': [],
      'أمس': [],
      'الأسبوع الماضي': [],
      'أقدم': []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    filteredHistory.forEach(chat => {
      if (chat.pinned) {
        groups['المثبتة'].push(chat);
        return;
      }

      const chatDate = new Date(chat.timestamp);
      chatDate.setHours(0, 0, 0, 0);

      if (chatDate.getTime() === today.getTime()) {
        groups['اليوم'].push(chat);
      } else if (chatDate.getTime() === yesterday.getTime()) {
        groups['أمس'].push(chat);
      } else if (chatDate.getTime() > lastWeek.getTime()) {
        groups['الأسبوع الماضي'].push(chat);
      } else {
        groups['أقدم'].push(chat);
      }
    });

    // Sort each group by timestamp descending
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => b.timestamp - a.timestamp);
    });

    return groups;
  }, [filteredHistory]);

  const shareMessage = (text: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'مداد الرحمن',
        text: text,
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      });
    }
  };

  const stopRecitation = () => {
    currentRecitationIdRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsGeneratingAudio(null);
  };

  const handleAIRecitation = async (text: string, messageId: number) => {
    const currentId = messageId.toString();
    
    if (isGeneratingAudio) {
      stopRecitation();
    }
    
    // Stop any browser speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    // Check if we already have this audio cached in memory
    if (audioUrls[currentId]) {
      setIsGeneratingAudio(currentId);
      currentRecitationIdRef.current = currentId;
      if (audioRef.current) {
        audioRef.current.pause();
        // Do NOT revoke the URL here, as it's still in the cache!
      }
      const audio = new Audio(audioUrls[currentId]);
      audio.playbackRate = aiRecitationSettings?.rate || 1.0;
      audioRef.current = audio;
      audio.onended = () => { setIsGeneratingAudio(null); currentRecitationIdRef.current = null; };
      audio.onerror = (e) => { console.error("Audio playback error:", e); setIsGeneratingAudio(null); currentRecitationIdRef.current = null; };
      await audio.play().catch(e => { 
        if (e.name !== 'AbortError') console.error(e); 
        setIsGeneratingAudio(null); 
        currentRecitationIdRef.current = null; 
      });
      return;
    }

    // Create text hash for robust caching
    const hashText = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    };
    
    // Check IndexedDB cache
    const cacheKey = `${currentId}_${selectedVoice}_${hashText(text)}`;
    const cachedBlob = await getAudioFromCache(cacheKey);
    if (cachedBlob) {
      const url = URL.createObjectURL(cachedBlob);
      globalAudioUrls[currentId] = url;
      setAudioUrls(prev => ({ ...prev, [currentId]: url }));
      
      setIsGeneratingAudio(currentId);
      currentRecitationIdRef.current = currentId;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.playbackRate = aiRecitationSettings?.rate || 1.0;
      audioRef.current = audio;
      audio.onended = () => { setIsGeneratingAudio(null); currentRecitationIdRef.current = null; };
      audio.onerror = (e) => { console.error("Audio playback error:", e); setIsGeneratingAudio(null); currentRecitationIdRef.current = null; };
      await audio.play().catch(e => { 
        if (e.name !== 'AbortError') console.error(e); 
        setIsGeneratingAudio(null); 
        currentRecitationIdRef.current = null; 
      });
      return;
    }
    
    setIsGeneratingAudio(currentId);
    currentRecitationIdRef.current = currentId;
    
    const audioQueue: string[] = [];
    let isPlaying = false;
    let isFinishedGenerating = false;
    let fallbackTriggered = false;

    const playNext = () => {
      if (fallbackTriggered || currentRecitationIdRef.current !== currentId) {
        while(audioQueue.length > 0) {
          URL.revokeObjectURL(audioQueue.shift()!);
        }
        return;
      }
      
      if (audioQueue.length > 0) {
        isPlaying = true;
        const url = audioQueue.shift()!;
        const audio = new Audio(url);
      audio.playbackRate = aiRecitationSettings?.rate || 1.0;
        audioRef.current = audio;
        
        let nextCalled = false;
        const callNext = () => {
          if (!nextCalled) {
            nextCalled = true;
            URL.revokeObjectURL(url);
            playNext();
          }
        };

        audio.onended = callNext;
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          callNext();
        };

        audio.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Audio play error", e);
          }
          callNext();
        });
      } else {
        isPlaying = false;
        if (isFinishedGenerating) {
          setIsGeneratingAudio(null);
          currentRecitationIdRef.current = null;
        }
      }
    };

    const pcmBlobs: Blob[] = [];

    try {
      for await (const chunk of generateRecitationStream(text, selectedVoice)) {
        if (fallbackTriggered || currentRecitationIdRef.current !== currentId) {
          while(audioQueue.length > 0) {
            URL.revokeObjectURL(audioQueue.shift()!);
          }
          break;
        }
        
        // Accumulate raw PCM data for the final downloadable file
        if (chunk.pcmData) {
          const rawPcmString = atob(chunk.pcmData.replace(/\s/g, ''));
          const rawPcmBytes = new Uint8Array(rawPcmString.length);
          for (let i = 0; i < rawPcmString.length; i++) {
            rawPcmBytes[i] = rawPcmString.charCodeAt(i);
          }
          
          // Check if it has a WAV header and strip it
          const hasWavHeader = rawPcmBytes.length >= 44 && 
                               rawPcmBytes[0] === 0x52 && 
                               rawPcmBytes[1] === 0x49 && 
                               rawPcmBytes[2] === 0x46 && 
                               rawPcmBytes[3] === 0x46;
          
          const actualPcmBytes = hasWavHeader ? rawPcmBytes.slice(44) : rawPcmBytes;
          pcmBlobs.push(new Blob([actualPcmBytes]));
        }

        const base64Data = chunk.data.replace(/\s/g, '');
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        
        const blob = new Blob(byteArrays, { type: chunk.mimeType });
        const url = URL.createObjectURL(blob);
        
        audioQueue.push(url);
        
        if (!isPlaying) {
          playNext();
        }
      }
      
      isFinishedGenerating = true;
      
      // Create final combined WAV for downloading
      if (pcmBlobs.length > 0 && !fallbackTriggered) {
        const pcmBlob = new Blob(pcmBlobs);
        const pcmArrayBuffer = await pcmBlob.arrayBuffer();
        const len = pcmArrayBuffer.byteLength;
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        view.setUint32(0, 0x52494646, false); // RIFF
        view.setUint32(4, 36 + len, true); // file length
        view.setUint32(8, 0x57415645, false); // WAVE
        view.setUint32(12, 0x666d7420, false); // fmt 
        view.setUint32(16, 16, true); // format chunk length
        view.setUint16(20, 1, true); // sample format (raw)
        view.setUint16(22, 1, true); // channel count
        view.setUint32(24, 24000, true); // sample rate
        view.setUint32(28, 24000 * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        view.setUint32(36, 0x64617461, false); // data
        view.setUint32(40, len, true); // data chunk length
        
        const finalBlob = new Blob([wavHeader, pcmArrayBuffer], { type: 'audio/wav' });
        const finalUrl = URL.createObjectURL(finalBlob);
        
        globalAudioUrls[currentId] = finalUrl;
        setAudioUrls(prev => ({ ...prev, [currentId]: finalUrl }));
        
        // Save to IndexedDB cache
        const hashText = (str: string) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return hash.toString(36);
        };
        const cacheKey = `${currentId}_${selectedVoice}_${hashText(text)}`;
        saveAudioToCache(cacheKey, finalBlob);
      }

      if (!isPlaying && audioQueue.length === 0) {
        setIsGeneratingAudio(null);
      }
    } catch (error) {
      const isHardQuota = error === "HARD_QUOTA_LIMIT" || (error instanceof Error && error.message === "HARD_QUOTA_LIMIT");
      if (isHardQuota) {
        console.warn('Recitation quota limit reached. Falling back to browser TTS.');
        setQuotaError("تم الوصول إلى الحد الأقصى لحصة الاستخدام. سيتم استخدام القراءة التلقائية للمتصفح.");
        setTimeout(() => setQuotaError(null), 5000);
      } else {
        console.error('Recitation error:', error);
      }
      fallbackTriggered = true;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsGeneratingAudio(null);
      fallbackToBrowserTTS(text, messageId.toString());
    }
  };

  const fallbackToBrowserTTS = (text: string, id: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = aiRecitationSettings?.rate || 0.9;
      
      utterance.onstart = () => setIsGeneratingAudio(id);
      utterance.onend = () => setIsGeneratingAudio(null);
      utterance.onerror = () => setIsGeneratingAudio(null);
      
      window.speechSynthesis.speak(utterance);
    } else {
      setIsGeneratingAudio(null);
    }
  };

  const isReadingAllRef = useRef(false);

  const handleReadAllRecitation = async () => {
    if (isGeneratingAudio === 'all') {
      setIsGeneratingAudio(null);
      isReadingAllRef.current = false;
      stopRecitation();
      return;
    }
    
    // Stop any browser speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) return;
    
    const fullText = assistantMessages.map(m => m.content).join('\n\n');
    // Simple hash for the full text to invalidate cache when new messages arrive
    const textHash = 'all_' + fullText.length + '_' + fullText.substring(0, 20).replace(/\s/g, '');
    
    // Check memory first
    if (audioUrls[textHash]) {
        setIsGeneratingAudio('all');
        isReadingAllRef.current = true;
        currentRecitationIdRef.current = 'all';
        // Play existing
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(audioUrls[textHash]);
        audio.playbackRate = aiRecitationSettings?.rate || 1.0;
        audioRef.current = audio;
        audio.onended = () => { setIsGeneratingAudio(null); isReadingAllRef.current = false; currentRecitationIdRef.current = null; };
        audio.onerror = (e) => { console.error("Audio playback error:", e); setIsGeneratingAudio(null); isReadingAllRef.current = false; currentRecitationIdRef.current = null; };
        await audio.play().catch(e => { 
          if (e.name !== 'AbortError') console.error(e); 
          setIsGeneratingAudio(null); 
          isReadingAllRef.current = false; 
          currentRecitationIdRef.current = null; 
        });
        return;
    }

    // Check IndexedDB cache
    const cacheKey = `${textHash}_${selectedVoice}`;
    const cachedBlob = await getAudioFromCache(cacheKey);
    if (cachedBlob) {
      const url = URL.createObjectURL(cachedBlob);
      globalAudioUrls[textHash] = url;
      setAudioUrls(prev => ({ ...prev, [textHash]: url }));
      
      setIsGeneratingAudio('all');
      isReadingAllRef.current = true;
      currentRecitationIdRef.current = 'all';
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.playbackRate = aiRecitationSettings?.rate || 1.0;
      audioRef.current = audio;
      audio.onended = () => { setIsGeneratingAudio(null); isReadingAllRef.current = false; currentRecitationIdRef.current = null; };
      audio.onerror = (e) => { console.error("Audio playback error:", e); setIsGeneratingAudio(null); isReadingAllRef.current = false; currentRecitationIdRef.current = null; };
      await audio.play().catch(e => { 
        if (e.name !== 'AbortError') console.error(e); 
        setIsGeneratingAudio(null); 
        isReadingAllRef.current = false; 
        currentRecitationIdRef.current = null; 
      });
      return;
    }
    
    setIsGeneratingAudio('all');
    isReadingAllRef.current = true;
    currentRecitationIdRef.current = 'all';
    
    const audioQueue: string[] = [];
    let isPlaying = false;
    let isFinishedGenerating = false;
    let fallbackTriggered = false;

    const playNext = () => {
      if (!isReadingAllRef.current || fallbackTriggered || currentRecitationIdRef.current !== 'all') {
        while(audioQueue.length > 0) {
          URL.revokeObjectURL(audioQueue.shift()!);
        }
        return;
      }
      
      if (audioQueue.length > 0) {
        isPlaying = true;
        const url = audioQueue.shift()!;
        const audio = new Audio(url);
      audio.playbackRate = aiRecitationSettings?.rate || 1.0;
        audioRef.current = audio;
        
        let nextCalled = false;
        const callNext = () => {
          if (!nextCalled) {
            nextCalled = true;
            URL.revokeObjectURL(url);
            playNext();
          }
        };

        audio.onended = callNext;
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          callNext();
        };
        
        audio.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Audio play failed:", e);
          }
          callNext();
        });
      } else if (isFinishedGenerating) {
        setIsGeneratingAudio(null);
        isReadingAllRef.current = false;
        currentRecitationIdRef.current = null;
      } else {
        isPlaying = false;
      }
    };

    let combinedPcmBytes = new Uint8Array(0);

    try {
      for await (const chunk of generateRecitationStream(fullText, selectedVoice)) {
        if (fallbackTriggered || currentRecitationIdRef.current !== 'all') {
          while(audioQueue.length > 0) {
            URL.revokeObjectURL(audioQueue.shift()!);
          }
          break;
        }
        
        if (chunk.pcmData) {
          const rawPcmString = atob(chunk.pcmData.replace(/\s/g, ''));
          const rawPcmBytes = new Uint8Array(rawPcmString.length);
          for (let i = 0; i < rawPcmString.length; i++) {
            rawPcmBytes[i] = rawPcmString.charCodeAt(i);
          }
          
          const hasWavHeader = rawPcmBytes.length >= 44 && 
                               rawPcmBytes[0] === 0x52 && 
                               rawPcmBytes[1] === 0x49 && 
                               rawPcmBytes[2] === 0x46 && 
                               rawPcmBytes[3] === 0x46;
          
          const actualPcmBytes = hasWavHeader ? rawPcmBytes.slice(44) : rawPcmBytes;

          const newCombined = new Uint8Array(combinedPcmBytes.length + actualPcmBytes.length);
          newCombined.set(combinedPcmBytes, 0);
          newCombined.set(actualPcmBytes, combinedPcmBytes.length);
          combinedPcmBytes = newCombined;
        }

        const base64Data = chunk.data.replace(/\s/g, '');
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        
        const blob = new Blob(byteArrays, { type: chunk.mimeType });
        const url = URL.createObjectURL(blob);
        
        audioQueue.push(url);
        
        if (!isPlaying) {
          playNext();
        }
      }
      
      isFinishedGenerating = true;
      
      if (combinedPcmBytes.length > 0 && !fallbackTriggered) {
        const len = combinedPcmBytes.length;
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        view.setUint32(0, 0x52494646, false); // RIFF
        view.setUint32(4, 36 + len, true); // file length
        view.setUint32(8, 0x57415645, false); // WAVE
        view.setUint32(12, 0x666d7420, false); // fmt 
        view.setUint32(16, 16, true); // format chunk length
        view.setUint16(20, 1, true); // sample format (raw)
        view.setUint16(22, 1, true); // channel count
        view.setUint32(24, 24000, true); // sample rate
        view.setUint32(28, 24000 * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        view.setUint32(36, 0x64617461, false); // data
        view.setUint32(40, len, true); // data chunk length
        
        const finalWav = new Uint8Array(44 + len);
        finalWav.set(new Uint8Array(wavHeader), 0);
        finalWav.set(combinedPcmBytes, 44);
        
        const finalBlob = new Blob([finalWav], { type: 'audio/wav' });
        const finalUrl = URL.createObjectURL(finalBlob);
        
        globalAudioUrls[textHash] = finalUrl;
        setAudioUrls(prev => ({ ...prev, [textHash]: finalUrl }));
        
        const cacheKey = `${textHash}_${selectedVoice}`;
        saveAudioToCache(cacheKey, finalBlob);
      }

      if (!isPlaying && audioQueue.length === 0) {
        setIsGeneratingAudio(null);
      }
    } catch (error) {
      const isHardQuota = error === "HARD_QUOTA_LIMIT" || (error instanceof Error && error.message === "HARD_QUOTA_LIMIT");
      if (isHardQuota) {
        console.warn('Recitation quota limit reached. Falling back to browser TTS.');
        setQuotaError("تم الوصول إلى الحد الأقصى لحصة الاستخدام. سيتم استخدام القراءة التلقائية للمتصفح.");
        setTimeout(() => setQuotaError(null), 5000);
      } else {
        console.error('Recitation error:', error);
      }
      fallbackTriggered = true;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsGeneratingAudio(null);
      fallbackToBrowserTTS(fullText, 'all');
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 1, y: 0 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-[100dvh] sm:w-[98vw] sm:h-[98vh] max-w-none bg-[#fcfaf7] dark:bg-[#0c0a09] flex flex-col overflow-hidden sm:rounded-2xl shadow-2xl border border-amber-100/50 dark:border-amber-900/30 relative"
          aria-label="واجهة مداد الرحمن"
          role="dialog"
        >
        {/* Floating Zen Mode Restore & Exit Buttons */}
        {isZenMode && (
          <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={onClose}
              className="pointer-events-auto p-2.5 rounded-full bg-white/95 dark:bg-[#1c1917]/95 backdrop-blur-md border border-amber-200/50 dark:border-amber-800/50 text-amber-900 dark:text-amber-100 shadow-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all hover:scale-105 flex items-center gap-2 text-xs font-bold font-kufi"
              title="الرجوع للصفحة الرئيسية"
            >
              <ChevronLeft size={16} className="text-amber-600" />
              <span>الرئيسية</span>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setIsZenMode(false)}
              className="pointer-events-auto p-2.5 rounded-full bg-white/95 dark:bg-[#1c1917]/95 backdrop-blur-md border border-amber-200/50 dark:border-amber-800/50 text-amber-900 dark:text-amber-100 shadow-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all hover:scale-105 flex items-center gap-2 text-xs font-bold font-kufi"
              title="إظهار الهيكل (إلغاء الوضع البسيط)"
            >
              <Maximize2 size={15} className="text-amber-600 animate-pulse" />
              <span>إظهار الهيكل</span>
            </motion.button>
          </div>
        )}

        {/* Header */}
        {!isZenMode && (
          <div className="h-14 flex items-center justify-between px-4 bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-md border-b border-amber-200/50 dark:border-amber-800/50 sticky top-0 z-40 shrink-0">
            <div 
              onClick={() => scrollToTop('smooth')}
              className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-all select-none shrink-0"
              title="انقر للتمرير السريع للأعلى"
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHistory(!showHistory);
                }}
                className={`p-2 rounded-xl transition-all ${showHistory ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100' : 'hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}
                title="السجل"
              >
                <History size={18} />
              </button>
              <div className="flex flex-col">
                <h2 className="text-sm sm:text-base font-bold text-amber-900 dark:text-amber-100 font-kufi leading-none">مداد الرحمن</h2>
                <span className="text-[9px] text-amber-600/70 dark:text-amber-400/70 font-bold tracking-tight">بحر الكلمات لا ينفد</span>
              </div>
            </div>
            
            <div className="relative flex-1 min-w-0 flex items-center h-full mx-2 overflow-hidden">
              {/* Right Arrow (Scroll back to start - right side in RTL) */}
              {showRightArrow && (
                <button
                  onClick={() => scrollTopBar('right')}
                  className="absolute right-0 z-30 p-1.5 rounded-full bg-white/95 dark:bg-[#1c1917]/95 shadow-md border border-amber-200/50 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-all hover:scale-105"
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                  title="التمرير لليمين"
                >
                  <ChevronRight size={14} className="stroke-[3]" />
                </button>
              )}

              {/* Scrollable Buttons Row */}
              <div 
                ref={topBarRef}
                className="w-full flex items-center justify-start overflow-x-auto sm:scrollbar-none flex-nowrap whitespace-nowrap gap-1.5 sm:gap-2 px-6 select-none pb-1" 
                style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
              >
                <button
                  onClick={() => setShowLiveVoiceChat(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold transition-all shadow-md animate-pulse border border-amber-400/30 shrink-0"
                  title="محادثة Gemini Live المباشرة صوتياً لحظة بلحظة"
                >
                  <Radio size={14} className="text-amber-200 animate-spin-slow" />
                  <span>Gemini Live المباشر</span>
                </button>

                {/* أذن التجويد (الاستماع والتحليل) */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all border shrink-0 ${
                  isEarEnabled 
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300' 
                    : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                }`}>
                  <button
                    onClick={() => {
                      if (isEarEnabled) {
                        setShowTajweedAnalyzer(true);
                      } else {
                        setIsEarEnabled(true);
                        setShowTajweedAnalyzer(true);
                      }
                    }}
                    className="flex items-center gap-1 text-xs font-bold font-kufi transition-all"
                    title="مُحلل التجويد والمخارج الصوتي (أذن مداد)"
                  >
                    <Mic size={14} className={isEarEnabled ? 'text-amber-600' : 'text-zinc-400'} />
                    <span>أذن التجويد</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = !isEarEnabled;
                      setIsEarEnabled(next);
                      if (!next) setShowTajweedAnalyzer(false);
                    }}
                    className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 ${isEarEnabled ? 'bg-amber-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    title={isEarEnabled ? 'إلغاء تفعيل أذن التجويد' : 'تفعيل أذن التجويد'}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 transform ${isEarEnabled ? '-translate-x-3' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* شبكة المعرفة الكونية */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all border shrink-0 ${
                  isNetworkEnabled 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300' 
                    : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                }`}>
                  <button
                    onClick={() => {
                      if (isNetworkEnabled) {
                        setShowCosmicGraph(true);
                      } else {
                        setIsNetworkEnabled(true);
                        setShowCosmicGraph(true);
                      }
                    }}
                    className="flex items-center gap-1 text-xs font-bold font-kufi transition-all"
                    title="شبكة المعرفة الكونية (QurSci-Onto Graph)"
                  >
                    <Globe size={14} className={isNetworkEnabled ? 'text-emerald-600' : 'text-zinc-400'} />
                    <span>شبكة المعرفة</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = !isNetworkEnabled;
                      setIsNetworkEnabled(next);
                      if (!next) setShowCosmicGraph(false);
                    }}
                    className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 ${isNetworkEnabled ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    title={isNetworkEnabled ? 'إلغاء تفعيل شبكة المعرفة' : 'تفعيل شبكة المعرفة'}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 transform ${isNetworkEnabled ? '-translate-x-3' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* مختبر الفيزياء والكون */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all border shrink-0 ${
                  isSandboxEnabled 
                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-800 dark:text-indigo-300' 
                    : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                }`}>
                  <button
                    onClick={() => {
                      if (isSandboxEnabled) {
                        setShowPhysicsSandbox(true);
                      } else {
                        setIsSandboxEnabled(true);
                        setShowPhysicsSandbox(true);
                      }
                    }}
                    className="flex items-center gap-1 text-xs font-bold font-kufi transition-all"
                    title="مختبر المحاكاة التفاعلي (Physics & Cosmos Sandbox)"
                  >
                    <Compass size={14} className={isSandboxEnabled ? 'text-indigo-600' : 'text-zinc-400'} />
                    <span>مختبر الفيزياء</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = !isSandboxEnabled;
                      setIsSandboxEnabled(next);
                      if (!next) setShowPhysicsSandbox(false);
                    }}
                    className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 ${isSandboxEnabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    title={isSandboxEnabled ? 'إلغاء تفعيل مختبر الفيزياء' : 'تفعيل مختبر الفيزياء'}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 transform ${isSandboxEnabled ? '-translate-x-3' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* المحلل اللغوي الميكرو-دلالي */}
                <button
                  onClick={() => setShowSemanticPrecision(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-bold font-kufi transition-all shrink-0"
                  title="محلل الفروق اللغوية الدقيقة (Semantic Micro-Precision)"
                >
                  <Book size={14} className="text-amber-600 dark:text-amber-400" />
                  <span>المحلل اللغوي الدقيق</span>
                </button>

                {/* البث الفلكي والمطابقة النصية */}
                <button
                  onClick={() => setShowCosmicObservatory(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold font-kufi transition-all shrink-0"
                  title="البث الكوني المباشر وبنك البيانات (Cosmic Observatory)"
                >
                  <Telescope size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>البث الفلكي</span>
                </button>

                {/* أدوات الميزات السريعة */}
                <button
                  onClick={() => onToolCall?.('control_app', 'open_feature', { feature: 'qibla' })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-800 dark:text-blue-300 text-xs font-bold font-kufi transition-all shrink-0"
                  title="اتجاه القبلة"
                >
                  <Compass size={14} className="text-blue-600" />
                  <span>القبلة</span>
                </button>
                <button
                  onClick={() => onToolCall?.('control_app', 'open_feature', { feature: 'prayer_times' })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-800 dark:text-purple-300 text-xs font-bold font-kufi transition-all shrink-0"
                  title="مواقيت الصلاة"
                >
                  <Calendar size={14} className="text-purple-600" />
                  <span>المواقيت</span>
                </button>
                <button
                  onClick={() => onToolCall?.('control_app', 'open_feature', { feature: 'tasbih' })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-800 dark:text-rose-300 text-xs font-bold font-kufi transition-all shrink-0"
                  title="المسبحة الإلكترونية"
                >
                  <RefreshCw size={14} className="text-rose-600" />
                  <span>التسبيح</span>
                </button>

                {/* توليد الصور داخل المحادثة */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all border shrink-0 ${
                  enableSpiritualImage 
                    ? 'bg-purple-500/10 border-purple-500/20 text-purple-800 dark:text-purple-300' 
                    : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                }`}>
                  <div className="flex items-center gap-1 text-xs font-bold font-kufi transition-all">
                    <span>🖼️</span>
                    <span>توليد الصور</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEnableSpiritualImage(!enableSpiritualImage);
                    }}
                    className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 ${enableSpiritualImage ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    title={enableSpiritualImage ? 'إلغاء تفعيل توليد الصور' : 'تفعيل توليد الصور'}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 transform ${enableSpiritualImage ? '-translate-x-3' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="w-px h-4 bg-amber-200/50 dark:bg-amber-800/50 mx-0.5 shrink-0"></div>
                
                <button 
                  onClick={() => setIsZenMode(true)}
                  className="p-2 rounded-xl transition-all hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 shrink-0"
                  title="الوضع البسيط (تركيز كامل وإخفاء الهيكل)"
                >
                  <Minimize2 size={18} />
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-xl transition-all shrink-0 ${showSettings ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100' : 'hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}
                  title="إعدادات"
                >
                  <Settings size={18} />
                </button>
                
                <div className="w-px h-4 bg-amber-200/50 dark:bg-amber-800/50 mx-1 shrink-0"></div>
                
                <button 
                  onClick={handleReadAllRecitation}
                  className={`p-2 rounded-xl transition-all shrink-0 ${isGeneratingAudio === 'all' ? 'text-amber-900 animate-pulse' : 'text-amber-700'}`}
                  title="قراءة الكل"
                >
                  <Volume2 size={18} />
                </button>
                <button 
                  onClick={copyChatAsMarkdown}
                  className="p-2 text-amber-700 hover:text-amber-900 shrink-0"
                  title="نسخ الكل"
                >
                  <Copy size={18} />
                </button>
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  className="p-2 text-red-500 hover:text-red-600 shrink-0"
                  title="مسح"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  onClick={onClose}
                  className="ml-1 p-1 px-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border border-amber-200/50 font-bold text-xs shrink-0"
                >
                  إغلاق
                </button>
              </div>

              {/* Left Arrow (Scroll further to left - end side in RTL) */}
              {showLeftArrow && (
                <button
                  onClick={() => scrollTopBar('left')}
                  className="absolute left-0 z-30 p-1.5 rounded-full bg-white/95 dark:bg-[#1c1917]/95 shadow-md border border-amber-200/50 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-all hover:scale-105"
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                  title="التمرير لليسار"
                >
                  <ChevronLeft size={14} className="stroke-[3]" />
                </button>
              )}
            </div>
          </div>
        )}
        
      {/* Clear Confirmation Overlay */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1c1917] w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-red-100 dark:border-red-900/30 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">مسح المحادثة؟</h3>
              <p className="text-amber-800/70 dark:text-amber-200/70 mb-8">هل أنت متأكد من رغبتك في مسح جميع الرسائل في هذه المحادثة؟ لا يمكن التراجع عن هذا الإجراء.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-bold hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={() => {
                    setMessages([{
                      role: 'assistant',
                      content: 'بسم الله الرحمن الرحيم. أنا «مداد الرحمن» – لسان الآية الكريمة ﴿لَوْ كَانَ الْبَحْرُ مِدَادًا لِكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَنْ تَنْفَدَ كَلِمَاتُ رَبِّي﴾. كيف يمكنني أن أساعدك في الغوص في هذا البحر الذي لا ينفد؟'
                    }]);
                    localStorage.removeItem('midad_alrahman_history');
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  نعم، امسح
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showClearAllConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            onClick={() => setShowClearAllConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1c1917] w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-red-100 dark:border-red-900/30 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">مسح السجل بالكامل؟</h3>
              <p className="text-amber-800/70 dark:text-amber-200/70 mb-8">هل أنت متأكد من رغبتك في مسح جميع المحادثات المسجلة؟ لا يمكن التراجع عن هذا الإجراء.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearAllConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-bold hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={clearAllHistory}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  نعم، امسح السجل
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showFactoryResetConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            onClick={() => setShowFactoryResetConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1c1917] w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-amber-100 dark:border-amber-950/40 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/30 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCw size={32} />
              </div>
              <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">إعادة ضبط المصنع؟</h3>
              <p className="text-amber-800/70 dark:text-amber-200/70 mb-8">سيقوم هذا الخيار بمسح جميع المحادثات والبيانات المسجلة، وإعادة جميع الإعدادات للوضع الافتراضي الأولي تماماً.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowFactoryResetConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 font-bold hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="flex-1 py-3 rounded-2xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20"
                >
                  نعم، أعد الضبط
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Overlay */}
      <AnimatePresence>
        {showHelp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            onClick={() => setShowHelp(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1c1917] w-full max-w-md rounded-3xl p-8 shadow-2xl border border-amber-100 dark:border-amber-900/50 text-right"
              onClick={e => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                  <HelpCircle size={24} />
                </div>
                <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100">دليل مداد الرحمن</h3>
              </div>
              
              <div className="space-y-6 text-amber-800 dark:text-amber-200 leading-relaxed">
                <div className="flex gap-4">
                  <div className="mt-1 text-amber-600"><Sparkles size={20} /></div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">تقديم أفكار</h4>
                    <p className="text-sm opacity-80">اطلب من مداد اقتراح أفكار إبداعية للتأمل في القرآن أو مشاركة معانيه.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="mt-1 text-amber-600"><Search size={20} /></div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">بحث قرآني ذكي</h4>
                    <p className="text-sm opacity-80">ابحث عن موضوعات محددة وسيقوم مداد بجمع الآيات ذات الصلة وشرحها.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="mt-1 text-amber-600"><ImageIcon size={20} /></div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">توليد رؤى بصرية</h4>
                    <p className="text-sm opacity-80">حول الآيات إلى صور فنية تعبر عن معانيها الروحية والجمالية.</p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setShowHelp(false)}
                className="w-full mt-8 py-4 rounded-2xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20"
              >
                فهمت ذلك
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden relative">
        {quotaError && (
          <div className="absolute top-4 left-4 right-4 bg-amber-500 text-white p-4 rounded-lg shadow-lg z-50 text-center">
            {quotaError}
          </div>
        )}
        {microphoneError && (
          <div className="absolute top-4 left-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 text-center">
            {microphoneError}
          </div>
        )}
        {/* History Sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-y-0 right-0 w-full sm:w-80 bg-white/95 dark:bg-[#1c1917]/95 backdrop-blur-3xl border-l border-amber-100 dark:border-amber-900 z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-amber-100 dark:border-amber-900 flex justify-between items-center bg-amber-50/50 dark:bg-amber-900/10">
                <h3 className="font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                  <History size={18} /> سجل المداد
                </h3>
                <div className="flex gap-1">
                  <button onClick={exportChats} className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-700" title="تصدير السجل"><Download size={16} /></button>
                  <label className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-700 cursor-pointer" title="استيراد السجل">
                    <Upload size={16} />
                    <input type="file" className="hidden" onChange={importChats} accept=".json" />
                  </label>
                  <button onClick={() => setShowHistory(false)} className="p-1.5 hover:bg-amber-100 rounded-lg"><X size={18} /></button>
                </div>
              </div>
              <div className="p-3 border-b border-amber-100 dark:border-amber-900">
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="بحث في السجل..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-2 pr-8 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                    dir="rtl"
                  />
                  <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-400" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <button 
                  onClick={startNewChat}
                  className="w-full p-3 rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center gap-2 font-bold transition-all"
                >
                  <RefreshCw size={18} /> محادثة جديدة
                </button>
                {filteredHistory.length === 0 ? (
                  <div className="py-10 text-center text-amber-400 dark:text-amber-600/70 italic text-sm">
                    {searchQuery ? 'لم يتم العثور على نتائج' : 'لا يوجد سجل محادثات بعد'}
                  </div>
                ) : (
                  Object.entries(groupedChats).map(([groupName, chats]) => {
                    if (chats.length === 0) return null;
                    return (
                      <div key={groupName} className="mb-4">
                        <h4 className="text-xs font-bold text-amber-600/70 dark:text-amber-500/70 mb-2 px-2 flex items-center gap-1">
                          {groupName === 'المثبتة' && <Pin size={12} />}
                          {groupName === 'اليوم' && <Calendar size={12} />}
                          {groupName}
                        </h4>
                        <div className="space-y-1">
                          {chats.map(chat => (
                            <div 
                              key={chat.id}
                              onClick={() => loadChat(chat)}
                              className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${chat.id === currentChatId ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700' : 'hover:bg-amber-50 border-transparent dark:hover:bg-amber-900/20'}`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  {editingChatId === chat.id ? (
                                    <input
                                      type="text"
                                      value={editTitleValue}
                                      onChange={(e) => setEditTitleValue(e.target.value)}
                                      onBlur={(e) => saveEditTitle(chat.id, e as any)}
                                      onKeyDown={(e) => e.key === 'Enter' && saveEditTitle(chat.id, e)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full bg-white dark:bg-black border border-amber-300 rounded px-1 text-sm font-bold text-amber-900 dark:text-amber-100 outline-none"
                                      autoFocus
                                    />
                                  ) : (
                                    <p className="text-sm font-bold text-amber-900 dark:text-amber-100 truncate pl-6">{chat.title}</p>
                                  )}
                                  <p className="text-[10px] text-amber-500 mt-1">{new Date(chat.timestamp).toLocaleString('ar-SA')}</p>
                                </div>
                                <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-black/80 backdrop-blur-sm p-1 rounded-lg shadow-sm">
                                  <button 
                                    onClick={(e) => togglePinChat(chat.id, e)}
                                    className={`p-1.5 rounded-md transition-all ${chat.pinned ? 'text-amber-600 bg-amber-100' : 'text-amber-400 hover:bg-amber-50 hover:text-amber-600'}`}
                                    title={chat.pinned ? "إلغاء التثبيت" : "تثبيت"}
                                  >
                                    <Pin size={12} className={chat.pinned ? "fill-current" : ""} />
                                  </button>
                                  <button 
                                    onClick={(e) => startEditTitle(chat, e)}
                                    className="p-1.5 text-blue-400 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-all"
                                    title="تعديل العنوان"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button 
                                    onClick={(e) => deleteChat(chat.id, e)}
                                    className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-all"
                                    title="حذف"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
                <button 
                  onClick={() => setShowClearAllConfirm(true)}
                  className="w-full p-2 text-[10px] text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center gap-1 transition-colors mt-4"
                >
                  <Trash2 size={12} /> مسح السجل بالكامل
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Sidebar */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="absolute inset-y-0 left-0 w-full sm:w-80 bg-white dark:bg-[#1c1917] border-r border-amber-100 dark:border-amber-900 z-40 shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-amber-100 dark:border-amber-900 flex justify-between items-center bg-amber-50/50 dark:bg-amber-900/10">
                <h3 className="font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                  <Settings size={18} /> إعدادات المداد
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-amber-100 rounded-lg"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pb-12 space-y-6">
                <section>
                  <label className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 block">مزود الذكاء الاصطناعي</label>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(AI_PROVIDERS) as AIProviderKey[]).map(key => (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedProvider(key);
                          const defaultM = AI_PROVIDERS[key].defaultModel;
                          setSelectedModel(`${key}|${defaultM}`);
                          safeLocalStorageSet('midad_provider', key);
                          safeLocalStorageSet('midad_model', defaultM);
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${selectedProvider === key ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-amber-50/30 border-amber-100 text-amber-700 hover:border-amber-300'}`}
                      >
                        <div className="flex items-center gap-3">
                          {key === 'gemini' && <Brain size={18} className="text-blue-500" />}
                          {key === 'groq' && <Zap size={18} className="text-orange-500" />}
                          {key === 'mistral' && <Sparkles size={18} className="text-orange-400" />}
                          {key === 'openrouter' && <Cpu size={18} className="text-purple-500" />}
                          {key === 'routeway' && <ShieldCheck size={18} className="text-green-500" />}
                          <span className="font-bold text-sm">{AI_PROVIDERS[key].name}</span>
                        </div>
                        {selectedProvider === key && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-amber-600 uppercase tracking-wider block">النموذج المختار</label>
                    <button
                      onClick={handleRefreshModels}
                      disabled={isUpdatingModels}
                      className="text-[10px] text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 flex items-center gap-1 hover:underline disabled:opacity-55"
                      title="تحديث النماذج تلقائياً من خوادم المزود"
                    >
                      {isUpdatingModels ? (
                        <>
                          <Loader2 size={10} className="animate-spin" />
                          جاري التحديث...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={10} />
                          تحديث تلقائي من المصدر
                        </>
                      )}
                    </button>
                  </div>
                  {modelsUpdatedMessage && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 mb-2 py-1 px-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-100 dark:border-amber-900/60 animate-pulse text-center font-medium">
                      {modelsUpdatedMessage}
                    </p>
                  )}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {Array.from(new Set(getDynamicModelsList(selectedProvider) as string[])).map((modelName: string) => (
                      <button
                        key={modelName}
                        onClick={() => {
                          const newVal = `${selectedProvider}|${modelName}`;
                          setSelectedModel(newVal);
                          safeLocalStorageSet('midad_model', modelName);
                          safeLocalStorageSet('midad_provider', selectedProvider);
                          setModelsUpdatedMessage(`تم حفظ النموذج "${modelName}" افتراضياً فوراً.`);
                          setTimeout(() => setModelsUpdatedMessage(null), 3000);
                        }}
                        className={`w-full text-right p-3 rounded-xl border text-sm transition-all ${selectedModel === `${selectedProvider}|${modelName}` ? 'bg-amber-600 border-amber-700 text-white font-bold' : 'bg-white dark:bg-amber-900/10 border-amber-100 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:border-amber-300'}`}
                      >
                        {modelName}
                      </button>
                    ))}
                  </div>
                </section>
                
                <section>
                  <label className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Sliders size={14} /> معايير النموذج
                  </label>
                  <div className="space-y-4 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800">
                    <div className="space-y-3 mb-2 pb-3 border-b border-amber-200 dark:border-amber-800/50">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                          تفعيل التفكير العميق
                          <span className="text-[8px] bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-100 font-normal">تجريبي</span>
                        </span>
                        <div className="relative">
                          <input type="checkbox" className="sr-only" checked={enableDeepThinking} onChange={(e) => setEnableDeepThinking(e.target.checked)} />
                          <div className={`block w-8 h-4 rounded-full transition-colors ${enableDeepThinking ? 'bg-amber-600' : 'bg-amber-200 dark:bg-zinc-700'}`}></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-2 h-2 rounded-full transition-transform ${enableDeepThinking ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group pt-1">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                          تفعيل البحث العميق (Deep Research)
                          <span className="text-[8px] bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-100 font-normal">قوي</span>
                        </span>
                        <div className="relative">
                          <input type="checkbox" className="sr-only" checked={enableDeepResearch} onChange={(e) => setEnableDeepResearch(e.target.checked)} />
                          <div className={`block w-8 h-4 rounded-full transition-colors ${enableDeepResearch ? 'bg-amber-600' : 'bg-amber-200 dark:bg-zinc-700'}`}></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-2 h-2 rounded-full transition-transform ${enableDeepResearch ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group pt-1">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                          بحث الويب الحقيقي (من غوغل)
                        </span>
                        <div className="relative">
                          <input type="checkbox" className="sr-only" checked={enableWebSearch} onChange={(e) => setEnableWebSearch(e.target.checked)} />
                          <div className={`block w-8 h-4 rounded-full transition-colors ${enableWebSearch ? 'bg-amber-600' : 'bg-amber-200 dark:bg-zinc-700'}`}></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-2 h-2 rounded-full transition-transform ${enableWebSearch ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group pt-1">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                          صورة معبرة تلقائية (Pollinations)
                        </span>
                        <div className="relative">
                          <input type="checkbox" className="sr-only" checked={enableSpiritualImage} onChange={(e) => setEnableSpiritualImage(e.target.checked)} />
                          <div className={`block w-8 h-4 rounded-full transition-colors ${enableSpiritualImage ? 'bg-amber-600' : 'bg-amber-200 dark:bg-zinc-700'}`}></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-2 h-2 rounded-full transition-transform ${enableSpiritualImage ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                      </label>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-amber-800 dark:text-amber-200 mb-1">
                        <span>درجة الإبداع (Temperature)</span>
                        <span>{temperature}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="1" step="0.1" 
                        value={temperature}
                        onChange={(e) => setTemperature(Number(e.target.value))}
                        className="w-full accent-amber-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-amber-800 dark:text-amber-200 mb-1">
                        <span>طول الاستجابة الأقصى</span>
                        <span>{maxTokens} كلمة</span>
                      </div>
                      <input 
                        type="range" 
                        min="256" max="8192" step="256" 
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(Number(e.target.value))}
                        className="w-full accent-amber-600"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <label className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Trash2 size={14} /> إدارة البيانات والمصنع
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowClearAllConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 transition-all font-bold text-sm"
                    >
                      <Trash2 size={16} /> مسح كل السجل
                    </button>
                    <button
                      onClick={() => setShowFactoryResetConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-all font-bold text-sm"
                    >
                      <RefreshCw size={16} className="text-amber-600 dark:text-amber-400" /> إعادة ضبط المصنع
                    </button>
                  </div>
                </section>

                <section>
                  <label className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShieldCheck size={14} /> تنبيه هام وتدقيق
                  </label>
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 text-[10px] text-red-800 dark:text-red-200 leading-relaxed text-justify">
                    <p className="font-bold mb-1">﴿فَاسْأَلُوا أَهْلَ الذِّكْرِ إِن كُنتُمْ لَا تَعْلَمُونَ﴾</p>
                    إن استجابات «مداد الرحمن» هي نتاج تقنيات الذكاء الاصطناعي، ورغم حرصنا على استقاء الكلمات من القرآن والسنة، إلا أن الخطأ وارد. كلام الله يحتاج للتدقيق التام من المصادر الموثوقة والمصاحف المعتمدة. لا تعتمد على هذه المخرجات في الأحكام الشرعية أو الفتاوى دون الرجوع لأهل العلم.
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare size={14} /> تعليمات مخصصة
                    </label>
                    <button
                      onClick={generateSmartInstructions}
                      disabled={isGeneratingInstructions}
                      className="text-xs font-bold flex items-center gap-1 text-amber-600 hover:text-amber-700 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="توليد تعليمات مخصصة بذكاء اصطناعي"
                    >
                      {isGeneratingInstructions ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      توليد ذكي
                    </button>
                  </div>
                  <textarea 
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="أضف تعليمات خاصة لمداد الرحمن (مثلاً: ركز على آيات الصبر، أو تحدث بلهجة معينة...)"
                    className="w-full p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 text-xs outline-none focus:ring-1 focus:ring-amber-500 h-24 resize-none"
                    dir="rtl"
                  />
                </section>
                
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800 text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  <p className="font-bold mb-1">💡 نصيحة:</p>
                  تغيير النموذج قد يؤثر على عمق الاستجابة. نماذج Gemini و Llama 70B هي الأفضل لاستخراج "مداد الرحمن".
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => scrollToBottom('smooth')}
              className="absolute bottom-32 right-8 p-3 rounded-full bg-amber-600 text-white shadow-lg hover:bg-amber-700 transition-colors z-20"
              aria-label="الانتقال لآخر الرسائل"
            >
              <ArrowDown size={20} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <div 
          className="flex-1 flex flex-col overflow-hidden relative" 
          aria-live="polite"
        >
          {/* Ambient spiritual glow effect in Zen Mode */}
          {isZenMode && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              <motion.div 
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.03, 0.08, 0.03],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 blur-3xl"
              />
              <motion.div 
                animate={{
                  scale: [1.15, 1, 1.15],
                  opacity: [0.02, 0.06, 0.02],
                }}
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-emerald-300 to-amber-400 blur-3xl"
              />
            </div>
          )}

          {/* Scroll Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-100/20 dark:bg-amber-900/10 z-20">
            <motion.div 
              className="h-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
              style={{ width: `${scrollProgress}%` }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            />
          </div>
          
          <MessageList 
            messages={messages}
            handleAIRecitation={handleAIRecitation}
            stopRecitation={stopRecitation}
            isGeneratingAudio={isGeneratingAudio}
            sendMessage={sendMessage}
            copyToClipboard={copyToClipboard}
            shareMessage={shareMessage}
            copyFeedback={copyFeedback}
            audioUrls={audioUrls}
            downloadAudioFile={downloadAudioFile}
            selectedVoice={selectedVoice}
            onRegenerate={handleRegenerate}
            onEdit={handleEdit}
            isLoading={isLoading}
            selectedModel={selectedModel}
            providerName={AI_PROVIDERS[selectedProvider]?.name || 'Gemini'}
            isZenMode={isZenMode}
          />

          {/* Input Area */}
          <div className={`transition-all duration-500 ${isZenMode ? 'p-3 bg-transparent border-t-0 shadow-none z-10 w-full shrink-0' : 'p-3 sm:p-4 bg-white/80 dark:bg-[#1c1917]/80 backdrop-blur-xl border-t border-amber-100/50 dark:border-amber-900/50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] z-10 w-full shrink-0'}`}>
            <div className={`transition-all duration-500 w-full max-w-4xl mx-auto flex flex-col gap-2 ${isZenMode ? 'bg-white/95 dark:bg-[#171513]/95 shadow-[0_15px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-1.5 rounded-3xl border border-amber-200/50 dark:border-amber-900/40 backdrop-blur-xl max-w-3xl' : ''}`}>
              {/* Quick Suggestions Chips before input */}
              {!isZenMode && !isLoading && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide px-2 text-xs">
                  {currentContext?.surah && (
                    <button
                      onClick={() => sendMessage(`لخص لي سورة ${currentContext.surah} واشرح مقاصدها الرئيسية`)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 font-bold whitespace-nowrap hover:bg-amber-200 transition-all border border-amber-300/40 shrink-0"
                    >
                      <BookOpen size={13} className="text-amber-600" />
                      <span>لخص سورة {currentContext.surah}</span>
                    </button>
                  )}
                  {currentContext?.surah && currentContext?.ayah && (
                    <button
                      onClick={() => sendMessage(`اشرح لي الآية ${currentContext.ayah} من سورة ${currentContext.surah} واستخرج اللطائف والدروس`)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 font-bold whitespace-nowrap hover:bg-amber-200 transition-all border border-amber-300/40 shrink-0"
                    >
                      <Sparkles size={13} className="text-amber-600" />
                      <span>تفسير الآية {currentContext.ayah}</span>
                    </button>
                  )}
                  <button
                    onClick={() => sendMessage("اشرح لي هذه الآية بأسلوب تدبري واستخرج لي الدروس العملية منها")}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-stone-900 text-amber-900 dark:text-amber-200 font-bold whitespace-nowrap hover:bg-amber-50 dark:hover:bg-stone-800 transition-all border border-amber-200/60 dark:border-amber-800/60 shadow-sm shrink-0"
                  >
                    <Book size={13} className="text-amber-600" />
                    <span>شرح وتدبر الآية</span>
                  </button>
                  <button
                    onClick={() => sendMessage("ما هي أسباب نزول هذه السورة والمقاصد الكبرى لها؟")}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-stone-900 text-amber-900 dark:text-amber-200 font-bold whitespace-nowrap hover:bg-amber-50 dark:hover:bg-stone-800 transition-all border border-amber-200/60 dark:border-amber-800/60 shadow-sm shrink-0"
                  >
                    <Lightbulb size={13} className="text-amber-600" />
                    <span>أسباب النزول والمقاصد</span>
                  </button>
                  <button
                    onClick={() => sendMessage("ما هي أهم أحكام التجويد واللطائف اللغوية في هذه الآية؟")}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-stone-900 text-amber-900 dark:text-amber-200 font-bold whitespace-nowrap hover:bg-amber-50 dark:hover:bg-stone-800 transition-all border border-amber-200/60 dark:border-amber-800/60 shadow-sm shrink-0"
                  >
                    <ShieldAlert size={13} className="text-amber-600" />
                    <span>أحكام التجويد والبلاغة</span>
                  </button>
                  <button
                    onClick={() => sendMessage("احكِ لي القصة القرآنية والعبرة التربوية منها")}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-stone-900 text-amber-900 dark:text-amber-200 font-bold whitespace-nowrap hover:bg-amber-50 dark:hover:bg-stone-800 transition-all border border-amber-200/60 dark:border-amber-800/60 shadow-sm shrink-0"
                  >
                    <Sparkles size={13} className="text-amber-600" />
                    <span>القصص والعبر</span>
                  </button>
                </div>
              )}

              {/* Quick Actions before input */}
              {!isZenMode && !isLoading && (
                <div className="flex justify-center px-2 mb-1">
                  <div className="flex gap-2 p-1.5 bg-amber-50/50 dark:bg-amber-900/20 backdrop-blur-sm rounded-2xl border border-amber-100 dark:border-amber-900/50 overflow-x-auto scrollbar-hide max-w-full">
                    {messages.length > 1 && messages[messages.length-1].role === 'assistant' && (
                      <>
                        <button 
                          onClick={() => sendMessage('أكثر يا مداد الرحمن')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold whitespace-nowrap shadow-sm hover:shadow-md transition-all border border-amber-400/50"
                        >
                          <Sparkles size={14} className="animate-pulse" /> أكثر
                        </button>
                        {currentContext && (
                          <button 
                            onClick={() => {
                              if (currentContext.surah && !currentContext.ayah) {
                                sendMessage(`لخص لي سورة ${currentContext.surah} واستخرج لي أهم مقاصدها.`);
                              } else if (currentContext.surah && currentContext.ayah) {
                                sendMessage(`اشرح لي الآية ${currentContext.ayah} من سورة ${currentContext.surah} واستخرج لي الدروس المستفادة.`);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1c1917] text-amber-700 dark:text-amber-400 text-xs font-bold whitespace-nowrap border-r border-amber-200 dark:border-amber-800 transition-colors shadow-sm"
                          >
                            <BookOpen size={14} /> تدبر
                          </button>
                        )}
                      </>
                    )}
                    <button 
                      onClick={() => sendMessage("اقترح علي فكرة جديدة للتأمل في القرآن")} 
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white dark:hover:bg-black/20 text-amber-900 dark:text-amber-100 text-xs font-bold whitespace-nowrap transition-colors"
                    >
                      <Sparkles size={14} className="text-amber-600" /> فكرة
                    </button>
                    {isNetworkEnabled && (
                      <button 
                        onClick={() => sendMessage("ابحث في القرآن عن آيات تتحدث عن...")} 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white dark:hover:bg-black/20 text-amber-900 dark:text-amber-100 text-xs font-bold whitespace-nowrap border-r border-amber-200 dark:border-amber-800 transition-colors"
                      >
                        <Search size={14} className="text-emerald-600" /> بحث
                      </button>
                    )}
                    {/* Smart Quick Toggles */}
                    {(isNetworkEnabled || enableSpiritualImage) && (
                      <div className="flex items-center border-r border-amber-200 dark:border-amber-800 pr-2 mr-1 gap-1">
                        {isNetworkEnabled && (
                          <>
                            <button 
                              onClick={() => setEnableGroundedResearch(!enableGroundedResearch)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all text-xs font-bold ${enableGroundedResearch ? 'bg-teal-600 text-white shadow-sm' : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100'}`}
                              title={enableGroundedResearch ? "إلغاء البحث المتقدم الموثق" : "تفعيل البحث المتقدم الموثق بالويب والتفكير العالي"}
                            >
                              <Compass size={14} className={enableGroundedResearch ? "animate-spin-slow" : ""} />
                              <span>البحث الموثق</span>
                            </button>
                            <button 
                              onClick={() => setEnableDeepResearch(!enableDeepResearch)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all text-xs font-bold ${enableDeepResearch ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'}`}
                              title={enableDeepResearch ? "إلغاء البحث العميق" : "تفعيل البحث العميق عبر الوكيل"}
                            >
                              <Brain size={14} />
                              <span>البحث العميق</span>
                            </button>
                            <button 
                              onClick={() => setEnableDeepThinking(!enableDeepThinking)}
                              className={`flex items-center justify-center w-7 h-7 rounded-xl transition-all ${enableDeepThinking ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-white dark:hover:bg-black/20 text-amber-600/60 dark:text-amber-400/60'}`}
                              title={enableDeepThinking ? "إلغاء التفكير العميق" : "تفعيل التفكير العميق"}
                            >
                              <Lightbulb size={14} className={enableDeepThinking ? "fill-white" : ""} />
                            </button>
                            <button
                              onClick={() => setEnableWebSearch(!enableWebSearch)}
                              className={`flex items-center justify-center w-7 h-7 rounded-xl transition-all ${enableWebSearch ? 'bg-emerald-600 text-white shadow-sm' : 'hover:bg-white dark:hover:bg-black/20 text-emerald-600/60'}`}
                              title={enableWebSearch ? "إلغاء بحث الويب" : "تفعيل بحث الويب للتحقق"}
                            >
                              <Globe size={14} />
                            </button>
                          </>
                        )}
                        {enableSpiritualImage && (
                          <button
                            onClick={() => setEnableSpiritualImage(!enableSpiritualImage)}
                            className={`flex items-center justify-center w-7 h-7 rounded-xl transition-all ${enableSpiritualImage ? 'bg-purple-600 text-white shadow-sm' : 'hover:bg-white dark:hover:bg-black/20 text-purple-600/60'}`}
                            title={enableSpiritualImage ? "إلغاء الصورة المعبرة التلقائية" : "تفعيل توليد صور معبرة تلقائياً"}
                          >
                            <ImageIcon size={14} />
                          </button>
                        )}
                      </div>
                    )}
                    {enableSpiritualImage && (
                      <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('open_spiritual_vision', { detail: { text: 'تأمل في آية قرآنية' } }))} 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white dark:hover:bg-black/20 text-amber-900 dark:text-amber-100 text-xs font-bold whitespace-nowrap border-r border-amber-200 dark:border-amber-800 transition-colors"
                      >
                        <ImageIcon size={14} className="text-blue-600" /> صورة
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              <ChatInput 
                onSendMessage={sendMessage}
                isLoading={isLoading}
                isListening={isListening}
                isProcessingAudio={isProcessingAudio}
                toggleListening={toggleListening}
                draftKey="midad_input_draft"
                ref={chatInputRef}
              />
              
              {!isZenMode && (
                <div className="flex flex-col gap-2 mt-2">
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  </motion.div>

  {/* Modals for Midad's 3 Key Innovations */}
  {showTajweedAnalyzer && (
    <TajweedVoiceAnalyzer
      onClose={() => setShowTajweedAnalyzer(false)}
      onSendToChat={(text) => sendMessage(text)}
    />
  )}

  {showCosmicGraph && (
    <CosmicKnowledgeGraph
      onClose={() => setShowCosmicGraph(false)}
      onSendToChat={(text) => sendMessage(text)}
    />
  )}

  {showPhysicsSandbox && (
    <PhysicsCosmosSandbox
      onClose={() => setShowPhysicsSandbox(false)}
      onSendToChat={(text) => sendMessage(text)}
    />
  )}

  {showLiveVoiceChat && (
    <GeminiLiveVoiceChat
      onClose={() => setShowLiveVoiceChat(false)}
      onSendToChat={(text) => sendMessage(text)}
      onToolCall={onToolCall}
    />
  )}

  {showSemanticPrecision && (
    <SemanticPrecisionAnalyzer
      onClose={() => setShowSemanticPrecision(false)}
      onSendToChat={(text) => sendMessage(text)}
    />
  )}

  {showCosmicObservatory && (
    <CosmicObservatory
      onClose={() => setShowCosmicObservatory(false)}
      onSendToChat={(text) => sendMessage(text)}
    />
  )}
  </>
);
});


