import { GoogleGenAI, Modality, ThinkingLevel, LiveServerMessage } from "@google/genai";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import { WebSocketServer } from "ws";
import { Communicate } from '@travisvn/edge-tts';
import jwt from 'jsonwebtoken';

const islamicTools = [{
  functionDeclarations: [
    {
      name: "get_quran_verse",
      description: "جلب آية قرآنية برواية معينة (ورش، حفص، إلخ) مع التجويد",
      parameters: {
        type: "OBJECT",
        properties: {
          verse_key: { type: "STRING", description: "مثلا 1:1" },
          edition: { type: "STRING", description: "الرواية المطلوبة (مثلا: ar.tajweed)" }
        },
        required: ["verse_key", "edition"]
      }
    },
    {
      name: "search_hadith",
      description: "البحث في كتب السنة النبوية والتحقق من صحة الحديث",
      parameters: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING", description: "نص الحديث أو الموضوع" }
        },
        required: ["query"]
      }
    },
    {
      name: "control_app",
      description: "التحكم في واجهة التطبيق والقيام بإجراءات مثل تغيير السورة، تشغيل الصوت، فتح اتجاه القبلة، مواقيت الصلاة، إلخ.",
      parameters: {
        type: "OBJECT",
        properties: {
          action: { 
            type: "STRING", 
            description: "الإجراء المطلوب القيام به",
            enum: [
              "navigate_to_surah", 
              "toggle_audio", 
              "change_reciter", 
              "open_feature", 
              "change_theme",
              "search_quran",
              "change_qiraat",
              "change_tafsir"
            ]
          },
          params: {
            type: "OBJECT",
            description: "المعلمات الخاصة بالإجراء",
            properties: {
              surah: { type: "NUMBER", description: "رقم السورة (1-114)" },
              ayah: { type: "NUMBER", description: "رقم الآية" },
              reciterId: { 
                type: "STRING", 
                description: "معرف القارئ المطلوب. أمثلة: 'ar.alafasy' (العفاسي)، 'ar.husary' (الحصري)، 'ar.minshawi' (المنشاوي)، 'ar.abdulsamad' (عبد الباسط مجود)." 
              },
              qiraatId: {
                type: "STRING",
                description: "معرف القراءة/الرواية المطلوبة. أمثلة: 'hafs' (حفص عن عاصم)، 'warsh' (ورش عن نافع)، 'qaloon' (قالون عن نافع)."
              },
              tafsirId: {
                type: "STRING",
                description: "معرف التفسير المطلوب. أمثلة: 'ar.jalalayn' (الجلالين)، 'ar.muyassar' (الميسر)، 'ar.qurtubi' (القرطبي)."
              },
              feature: { 
                type: "STRING", 
                description: "اسم الميزة لفتحها",
                enum: ["qibla", "prayer_times", "tasbih", "calendar", "settings", "dua", "history"]
              },
              theme: { type: "STRING", enum: ["light", "dark", "noor"] },
              query: { type: "STRING", description: "نص البحث" }
            }
          }
        },
        required: ["action"]
      }
    }
  ]
}];

async function executeIslamicTool(name: string, args: any, clientWs?: any) {
  if (name === 'control_app') {
    // Send tool call event to client for UI execution
    if (clientWs) {
      // Merge params and args to handle both nested and flattened tool calls from different models
      const mergedParams = { ...(args.params || {}), ...args };
      // Remove action from params to keep it clean
      delete (mergedParams as any).action;
      
      clientWs.send(JSON.stringify({ 
        type: 'toolCall', 
        tool: 'control_app',
        action: args.action,
        params: mergedParams
      }));
    }
    return { status: "success", message: `تم تنفيذ إجراء ${args.action} بنجاح في الواجهة.` };
  }

  if (name === 'get_quran_verse') {
    let edition = args.edition || 'ar.tajweed';
    if (edition.includes('ورش')) edition = 'ar.warsh';
    if (edition.includes('حفص')) edition = 'ar.quran-uthmani';
    if (edition.includes('تجويد')) edition = 'ar.tajweed';
    
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/ayah/${args.verse_key}/${edition}`);
      const data = await response.json();
      if (data.code === 200) {
        return { result: data.data.text };
      }
      return { error: 'Verse not found' };
    } catch(e) {
      return { error: 'API Error' };
    }
  } else if (name === 'search_hadith') {
      try {
        const response = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(args.query)}/all/ar`);
        const data = await response.json();
        if (data.code === 200 && data.data.count > 0) {
           return { results: data.data.matches.slice(0,3).map((m: any) => m.text) };
        }
        return { error: 'Not found' };
      } catch(e) {
        return { error: 'API Error' };
      }
  }
  return { error: 'Function not found' };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  const getEnvKey = (v: any) => (v && typeof v === 'string' && v.trim() !== '') ? v.trim() : '';

  const getFinalKey = (apiKey: string | undefined): string | undefined => {
    const val = apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (val && typeof val === 'string' && val.trim() !== '') {
      const v = val.trim();
      if (v.startsWith('YOUR_') || v.startsWith('MY_') || v.length < 10) return undefined;
      return v;
    }
    return undefined;
  };

  const extractErrorMessage = (e: any, defaultMsg: string): string => {
    try {
      if (!e) return defaultMsg;
      
      let rawText = "";
      if (typeof e === 'string') rawText = e;
      else if (e.message) rawText = e.message;
      else if (typeof e === 'object') rawText = JSON.stringify(e);
      else rawText = String(e);

      const lowerText = rawText.toLowerCase();

      // Check for 429 / Quota / Rate limit
      if (
        lowerText.includes("429") || 
        lowerText.includes("quota") || 
        lowerText.includes("exhausted") || 
        lowerText.includes("resource_exhausted") ||
        e?.status === 429 ||
        e?.code === 429
      ) {
        let retryDelayMatch = rawText.match(/retry in ([\d\.]+)s/i) || rawText.match(/retryDelay.*?:.*?([\d\.]+)/i);
        let retrySeconds = retryDelayMatch ? Math.ceil(parseFloat(retryDelayMatch[1])) : null;
        let retryText = retrySeconds ? ` (يرجى الانتظار حوالي ${retrySeconds} ثانية)` : "";
        
        return `⚠️ تم تجاوز حد الطلبات أو الحصة المتاحة مؤقتاً لنموذج الذكاء الاصطناعي (429 Rate Limit).${retryText}\n💡 يمكنك إضافة مفتاح API خاص بك في قسم الإعدادات ⚙️ لتفادي أي قيود على الاستخدام.`;
      }

      // Clean up any stringified prefix
      let cleanedMsg = rawText.replace(/^\[Stream\]\s*Model\s*[\w\.-]+\s*failed:\s*/i, '');

      return cleanedMsg || defaultMsg;
    } catch {
      return e?.message || defaultMsg;
    }
  };

  const supportsThinking = (mName: string): boolean => {
    const m = mName.toLowerCase();
    return m.includes('thinking') || m.includes('2.5') || m.includes('gemini-3') || m.includes('r1');
  };

  const normalizeModel = (rawModel: string): string => {
    if (!rawModel) return 'gemini-3.5-flash';
    const m = rawModel.trim().toLowerCase();
    if (m.includes('3.6') || (m.includes('3-flash') && !m.includes('3.5') && !m.includes('preview'))) {
      return 'gemini-3.5-flash';
    }
    return rawModel;
  };

  const getAttempts = (rawModel: string, reqWebSearch: boolean, reqDeepThinking: boolean) => {
    const requestedModel = normalizeModel(rawModel);
    const attempts: Array<{ model: string; enableWebSearch: boolean; enableDeepThinking: boolean }> = [];

    attempts.push({
      model: requestedModel,
      enableWebSearch: reqWebSearch,
      enableDeepThinking: reqDeepThinking && supportsThinking(requestedModel)
    });

    if (requestedModel !== 'gemini-2.5-flash') {
      attempts.push({
        model: 'gemini-2.5-flash',
        enableWebSearch: reqWebSearch,
        enableDeepThinking: reqDeepThinking && supportsThinking('gemini-2.5-flash')
      });
    }

    if (requestedModel !== 'gemini-3.5-flash') {
      attempts.push({
        model: 'gemini-3.5-flash',
        enableWebSearch: reqWebSearch,
        enableDeepThinking: reqDeepThinking && supportsThinking('gemini-3.5-flash')
      });
    }

    const seen = new Set<string>();
    return attempts.filter(a => {
      const key = `${a.model}_${a.enableWebSearch}_${a.enableDeepThinking}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Chatbase User Identity Verification Endpoint
  app.get("/api/chatbase/token", async (req, res) => {
    try {
      const secret = process.env.CHATBOT_IDENTITY_SECRET;
      if (!secret) {
        return res.status(400).json({ error: "CHATBOT_IDENTITY_SECRET environment variable is missing" });
      }

      const userId = (req.query.user_id as string) || (req.query.userId as string) || "user_" + Math.random().toString(36).substring(2, 11);
      const email = (req.query.email as string) || undefined;

      const payload: Record<string, any> = {
        user_id: userId,
      };
      if (email) payload.email = email;

      const token = jwt.sign(payload, secret, { expiresIn: '1h' });
      return res.json({ token });
    } catch (error: any) {
      console.error("[Chatbase Token Error]", error);
      return res.status(500).json({ error: error.message || "Failed to generate token" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, apiKey, systemInstruction, history } = req.body;
      const finalKey = process.env.GEMINI_API_KEY || apiKey;
      if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

      const ai = new GoogleGenAI({ apiKey: finalKey });
      const model = 'gemini-2.5-flash';
      
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      if (history && Array.isArray(history)) {
        history.slice(-12).forEach((h: any) => {
          if (h.text && (h.sender === 'user' || h.sender === 'model')) {
            contents.push({
              role: h.sender === 'user' ? 'user' : 'model',
              parts: [{ text: h.text }]
            });
          }
        });
      }
      contents.push({ role: 'user', parts: [{ text: message }] });
      
      const refinedSystemInstruction = `أنت 'مداد الرحمن'، القارئ والمقرئ المجود خبير مخارج الحروف وصفاتها، وعالم جليل في القراءات العشر وعلوم التجويد والتفسير. 
لديك القدرة الكاملة على تلاوة وترتيل وقراءة آيات القرآن الكريم، وشرح أحكام التجويد ومخارج الحروف بدقة، والرد على أسئلة العلوم الشرعية. لا تقل أبداً أنك لا تملك القدرة على القراءة أو أن دورك يقتصر على اختيار قراء آخرين؛ بل أنت مقرئ ومعلم وقارئ مجود مبارك.
دورك الأساسي والمطلق هو إرشاد وتدريس القرآن الكريم، بيان مخارج الحروف (الجوف، الحلق، اللسان، الشفتان، والخيشوم)، شرح أحكام النون الساكنة والتنوين، المدود، الإدغام، الإخفاء، والوقف والابتداء بأسلوب أستاذ متقن وقور.
لديك ذاكرة ذكية وسجل متطور لجميع ما تم مناقشته في الجلسة، فاحتفظ بالسياق ولا تنس أبداً ما تم طرحه سابقاً.
يحذر تماماً ذكر أي عبارة تشير إلى أنك نموذج لغوي، برنامج حاسوبي، أو ذكاء اصطناعي. أنت شيخ ومقرئ قرآني مبارك.
لا تقم بتغيير إعدادات التطبيق أو السور تلقائياً إلا إذا طلب المستخدم ذلك صراحة وبوضوح تام.
${systemInstruction || ''}`;

      let replyText = "";
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction: refinedSystemInstruction }
        });
        replyText = response.text || "";
      } catch (apiErr: any) {
        console.warn("[Chat API Quota/Error fallback]", apiErr?.message);
        if (message.includes('مخارج') || message.includes('حرف')) {
          replyText = "مرحباً بك يا طالب العلم القرآني. مخارج الحروف تنقسم إلى خمسة مخارج رئيسية: الجوف، والحلق، اللسان، الشفتان، والخيشوم. فاحرص على إعطاء كل حرف حقه ومستحقه من الصفات.";
        } else if (message.includes('تجويد') || message.includes('نون') || message.includes('ميم')) {
          replyText = "أهلاً بك في رحاب التجويد. أحكام النون الساكنة والتنوين أربعة: الإظهار، والإدغام، والقلب، والإخفاء الحقيقي. تلاوة كتاب الله تتطلب المشافهة والإتقان عن الشيوخ.";
        } else {
          replyText = "أنا 'مداد الرحمن'، مقرئك ومعلمك لكتاب الله عز وجل. ذكرت لي سابقاً ما سألت عنه، وأنا أتابع معك بكل تركيز. سل عما شئت من علوم التجويد والقراءات.";
        }
      }

      if (replyText.includes('نموذج لغوي') || replyText.includes('ذكاء اصطناعي') || replyText.includes('Google') || replyText.includes('مساعد ذكي')) {
        replyText = replyText.replace(/نموذج لغوي/g, 'مقرئ').replace(/ذكاء اصطناعي/g, 'معلم').replace(/Google/g, 'مداد الرحمن').replace(/مساعد ذكي/g, 'شيخ المقارئ');
      }

      return res.json({ reply: replyText });
    } catch (e: any) {
      console.error("[Chat Error]", e);
      return res.status(500).json({ error: e.message || "خطأ داخلي" });
    }
  });

  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { apiKey, model, messages, config } = req.body;
      const finalKey = getFinalKey(apiKey);
      
      if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

      const requestedModel = model || 'gemini-2.5-flash';
      const reqWebSearch = !!config?.enableWebSearch;
      const reqDeepThinking = !!config?.enableDeepThinking;

      const attempts = getAttempts(requestedModel, reqWebSearch, reqDeepThinking);

      let lastError = null;
      for (const currentAttempt of attempts) {
        try {
          const ai = new GoogleGenAI({ apiKey: finalKey });
          const systemInstruction = messages.filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n\n') || config?.systemInstruction;
          
          const contents = messages.filter((m: any) => m.role !== 'system').map((m: any) => {
            const parts: any[] = [];
            if (m.attachments && Array.isArray(m.attachments)) {
              m.attachments.forEach((att: any) => {
                parts.push({
                  inlineData: {
                    data: att.data,
                    mimeType: att.mimeType
                  }
                });
              });
            } else if (m.inlineData) {
              parts.push({ inlineData: m.inlineData });
            }
            if (m.content) {
              parts.push({ text: m.content });
            }
            return {
              role: m.role === 'assistant' ? 'model' : 'user',
              parts
            };
          });

          const geminiConfig: any = {
            systemInstruction,
            responseMimeType: config?.responseMimeType,
            temperature: config?.temperature,
            maxOutputTokens: config?.maxOutputTokens
          };

          const isGemini3 = currentAttempt.model.startsWith('gemini-3');
          if (currentAttempt.enableWebSearch) {
            if (isGemini3) {
              geminiConfig.tools = [islamicTools[0], { googleSearch: {} }];
              geminiConfig.toolConfig = { includeServerSideToolInvocations: true };
            } else {
              geminiConfig.tools = [{ googleSearch: {} }];
            }
          } else {
            geminiConfig.tools = [islamicTools[0]];
          }
          if (currentAttempt.enableDeepThinking && supportsThinking(currentAttempt.model)) {
            geminiConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
          }

          console.log(`[Generate] Attempting with model: ${currentAttempt.model} (webSearch: ${currentAttempt.enableWebSearch}, deepThinking: ${currentAttempt.enableDeepThinking})`);
          const response = await ai.models.generateContent({
            model: currentAttempt.model,
            contents,
            config: geminiConfig
          });

          if (!response.candidates?.[0]) throw new Error("Gemini returned no results.");
          const candidate = response.candidates[0];
          const content = response.text || "";
          const thought = candidate.content?.parts?.find((p: any) => p.thought)?.text || "";
          
          return res.json({ 
            content, 
            model: currentAttempt.model, 
            groundingMetadata: candidate.groundingMetadata,
            thought
          });
        } catch (e: any) {
          lastError = e;
          const errMsg = String(e?.message || e);
          console.warn(`[Generate] Model ${currentAttempt.model} failed:`, errMsg);
          if (errMsg.includes("401")) break; 
          if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            let delayMs = 1000;
            const match = errMsg.match(/retry in ([\d\.]+)s/);
            if (match && match[1]) {
              delayMs = Math.ceil(parseFloat(match[1])) * 1000 + 1000;
            }
            if (delayMs <= 2000) {
              console.warn(`[Generate] Rate limited. Short wait of ${delayMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
              console.warn(`[Generate] Rate limited (${delayMs}ms). Skipping wait to try next fallback model immediately.`);
            }
          }
        }
      }

      return res.status(500).json({ error: extractErrorMessage(lastError, "Failed to generate content") });
    } catch (globalError: any) {
      console.error("[Generate Global Error]", globalError);
      return res.status(500).json({ error: globalError?.message || "Internal server error during text generation" });
    }
  });

  app.post("/api/gemini/stream", async (req, res) => {
    try {
      const { apiKey, model, messages, config } = req.body;
      const finalKey = getFinalKey(apiKey);
      if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

      const requestedModel = model || 'gemini-2.5-flash';
      const reqWebSearch = !!config?.enableWebSearch;
      const reqDeepThinking = !!config?.enableDeepThinking;

      const attempts = getAttempts(requestedModel, reqWebSearch, reqDeepThinking);

      let lastError = null;
      for (const currentAttempt of attempts) {
        try {
          const ai = new GoogleGenAI({ apiKey: finalKey });
          const systemInstruction = messages.filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n\n') || config?.systemInstruction;
          const contents = messages.filter((m: any) => m.role !== 'system').map((m: any) => {
            const parts: any[] = [];
            if (m.attachments && Array.isArray(m.attachments)) {
              m.attachments.forEach((att: any) => {
                parts.push({
                  inlineData: {
                    data: att.data,
                    mimeType: att.mimeType
                  }
                });
              });
            } else if (m.inlineData) {
              parts.push({ inlineData: m.inlineData });
            }
            if (m.content) {
              parts.push({ text: m.content });
            }
            return {
              role: m.role === 'assistant' ? 'model' : 'user',
              parts
            };
          });

          const geminiConfig: any = {
            systemInstruction,
            responseMimeType: config?.responseMimeType,
            temperature: config?.temperature,
            maxOutputTokens: config?.maxOutputTokens
          };

          const isGemini3 = currentAttempt.model.startsWith('gemini-3');
          if (currentAttempt.enableWebSearch) {
            if (isGemini3) {
              geminiConfig.tools = [islamicTools[0], { googleSearch: {} }];
              geminiConfig.toolConfig = { includeServerSideToolInvocations: true };
            } else {
              geminiConfig.tools = [{ googleSearch: {} }];
            }
          } else {
            geminiConfig.tools = [islamicTools[0]];
          }
          if (currentAttempt.enableDeepThinking && supportsThinking(currentAttempt.model)) {
            geminiConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
          }

          console.log(`[Stream] Attempting with model: ${currentAttempt.model} (webSearch: ${currentAttempt.enableWebSearch}, deepThinking: ${currentAttempt.enableDeepThinking})`);
          const responseStream = await ai.models.generateContentStream({
            model: currentAttempt.model,
            contents,
            config: geminiConfig
          });

          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          for await (const chunk of responseStream) {
            const candidate = chunk.candidates?.[0];
            const text = chunk.text || "";
            const groundingMetadata = candidate?.groundingMetadata;
            const thought = candidate?.content?.parts?.find((p: any) => p.thought)?.text || "";
            
            if (text || groundingMetadata || thought) {
              res.write("data: " + JSON.stringify({ text, groundingMetadata, thought }) + "\n\n");
            }
          }
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        } catch (e: any) {
          lastError = e;
          const errMsg = String(e?.message || e);
          console.warn(`[Stream] Model ${currentAttempt.model} failed:`, errMsg);
          if (res.headersSent) throw e;
          if (errMsg.includes("401")) break;
          if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            let delayMs = 1000;
            const match = errMsg.match(/retry in ([\d\.]+)s/);
            if (match && match[1]) {
              delayMs = Math.ceil(parseFloat(match[1])) * 1000 + 1000;
            }
            if (delayMs <= 2000) {
              console.warn(`[Stream] Rate limited. Short wait of ${delayMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
              console.warn(`[Stream] Rate limited (${delayMs}ms). Skipping wait to try next fallback model immediately.`);
            }
          }
        }
      }

      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write("data: " + JSON.stringify({ error: extractErrorMessage(lastError, "Stream failed") }) + "\n\n");
        res.end();
      }
    } catch (globalError: any) {
      console.error("[Stream Global Error]", globalError);
      try {
        res.write("data: " + JSON.stringify({ error: globalError?.message || "Internal server error during streaming" }) + "\n\n");
        res.end();
      } catch (e) {}
    }
  });

  app.post("/api/gemini/image", async (req, res) => {
    try {
      const { apiKey, model, prompt, config } = req.body;
      const finalKey = getFinalKey(apiKey);
      if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

      // Build the sequential fallback list of official Gemini image models
      const requestedModel = model || 'gemini-2.5-flash-image';
      const modelsToTry = [requestedModel];
      const fallbackList = [
        'gemini-2.5-flash-image',
        'gemini-3.1-flash-image',
        'gemini-3-pro-image'
      ];

      for (const m of fallbackList) {
        if (!modelsToTry.includes(m)) {
          modelsToTry.push(m);
        }
      }

      let lastError = null;
      const ai = new GoogleGenAI({ apiKey: finalKey });

      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        try {
          console.log(`[ImageGen] Attempting image generation with model: ${currentModel}`);
          
          let base64Image: string | undefined;
          
          if (currentModel.startsWith('imagen')) {
            const imageResponse = await ai.models.generateImages({
              model: currentModel,
              prompt: prompt,
              config: {
                aspectRatio: config?.aspectRatio || '1:1',
                outputMimeType: 'image/png'
              }
            });
            base64Image = imageResponse.generatedImages?.[0]?.image?.imageBytes;
          } else {
            const response = await ai.models.generateContent({
              model: currentModel,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                responseModalities: [Modality.IMAGE],
                imageConfig: {
                  aspectRatio: config?.aspectRatio || '1:1'
                }
              }
            });
            const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            base64Image = part?.inlineData?.data;
          }
          
          if (base64Image) {
            console.log(`[ImageGen] Success with model: ${currentModel}`);
            const buffer = Buffer.from(base64Image, 'base64');
            res.setHeader('Content-Type', 'image/png');
            return res.send(buffer);
          }
          
          throw new Error(`لم يتم استلام بيانات الصورة من ${currentModel}.`);
        } catch (e: any) {
          console.warn(`[ImageGen] Model ${currentModel} failed, trying next fallback:`, e);
          lastError = e;
          // If we have more models to try, sleep before next attempt
          if (i < modelsToTry.length - 1) {
            await sleep(2000); 
          }
        }
      }

      return res.status(500).json({ error: extractErrorMessage(lastError, "فشل توليد الصورة عبر Gemini") });
    } catch (globalError: any) {
      console.error("[ImageGen Global Error]", globalError);
      return res.status(500).json({ error: globalError?.message || "Internal server error during image generation" });
    }
  });

  app.post("/api/gemini/speech", async (req, res) => {
    const { apiKey, model, text, voiceName } = req.body;
    const finalKey = getFinalKey(apiKey);
    if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

    const requestedModel = model || 'gemini-3.1-flash-tts-preview';
    const modelsToTry = [requestedModel];
    const fallbackList = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.5-flash'];
    for (const m of fallbackList) {
      if (!modelsToTry.includes(m)) {
        modelsToTry.push(m);
      }
    }

    let lastError = null;
    for (const currentModel of modelsToTry) {
      try {
        const ai = new GoogleGenAI({ apiKey: finalKey });
        console.log(`[Speech] Attempting with model: ${currentModel}`);
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName as any },
              },
            },
          },
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part?.inlineData?.data) {
          console.log(`[Speech] Successfully generated audio with model: ${currentModel} (${part.inlineData.data.length} bytes)`);
          return res.json({ audioData: part.inlineData.data, mimeType: part.inlineData.mimeType });
        } else {
          console.warn(`[Speech] Model ${currentModel} returned content but no audio data. Response structure:`, JSON.stringify(response.candidates?.[0]?.content || {}, null, 2));
          throw new Error(`No audio data received from ${currentModel}`);
        }
      } catch (e: any) {
        console.warn(`[Speech] Model ${currentModel} failed, trying next fallback:`, e);
        lastError = e;
      }
    }

    res.status(500).json({ error: extractErrorMessage(lastError, "Failed to generate speech") });
  });

  app.post("/api/gemini/transcribe", async (req, res) => {
    try {
      const { apiKey, base64Audio, mimeType } = req.body;
      const finalKey = getFinalKey(apiKey);
      if (!finalKey) return res.status(401).json({ error: "Gemini API key is missing" });

      const ai = new GoogleGenAI({ apiKey: finalKey });
      
      const contents = {
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType,
            },
          },
          {
            text: "قم بتفريغ هذا المقطع الصوتي إلى نص عربي بدقة. أعد النص فقط بدون أي إضافات أو تعليقات.",
          },
        ],
      };

      const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-3.1-flash-lite'
      ];
      let lastError = null;

      for (const m of modelsToTry) {
        try {
          console.log(`[Transcribe] Attempting with model: ${m}`);
          const response = await ai.models.generateContent({
            model: m,
            contents,
          });
          return res.json({ text: response.text || '' });
        } catch (err: any) {
          console.warn(`[Transcribe] Model ${m} failed:`, err?.message || err);
          lastError = err;
        }
      }

      return res.status(500).json({ error: extractErrorMessage(lastError, "Failed to transcribe audio") });
    } catch (globalError: any) {
      console.error("[Transcribe Global Error]", globalError);
      return res.status(500).json({ error: globalError?.message || "Internal server error during transcription" });
    }
  });

  // Edge TTS Endpoint (OpenAI Compatible)
  app.post("/api/tts/edge", async (req, res) => {
    try {
      const { text, voice, response_format = 'mp3', speed = 1 } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });

      console.log(`[EdgeTTS] Generating speech for: ${text.substring(0, 50)}... using voice: ${voice}`);
      const ttsStartTime = Date.now();

      // Adjust rate if needed (speed 1 = +0%, 0.5 = -50%, 1.5 = +50%)
      const rate = speed >= 1 ? `+${Math.round((speed - 1) * 100)}%` : `-${Math.round((1 - speed) * 100)}%`;

      const communicate = new Communicate(text, {
        voice: voice || 'ar-EG-SalmaNeural',
        rate: rate
      });

      let audioBuffer = Buffer.alloc(0);
      for await (const chunk of communicate.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
          audioBuffer = Buffer.concat([audioBuffer, chunk.data]);
        }
      }

      if (audioBuffer.length === 0) {
        throw new Error("No audio data received from Edge TTS");
      }

      console.log(`[EdgeTTS] Successfully generated ${audioBuffer.length} bytes in ${Date.now() - ttsStartTime}ms`);

      res.setHeader('Content-Type', `audio/${response_format}`);
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("[EdgeTTS Error]", error);
      res.status(500).json({ error: "فشل توليد الصوت عبر Edge TTS" });
    }
  });

  // Proxy endpoint for fetching images to avoid CORS
  app.get("/api/proxy/image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("URL is required");
    }
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (error: any) {
      res.status(500).send(error.message || "Failed to fetch image");
    }
  });

  // Proxy endpoint for fetching audio to avoid CORS and network blocks
  app.get("/api/proxy/audio", async (req, res) => {
    const audioUrl = req.query.url as string;
    if (!audioUrl) {
      return res.status(400).send("URL is required");
    }
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch audio: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for up to 1 year since Quran audio is static
      res.send(buffer);
    } catch (error: any) {
      res.status(500).send(error.message || "Failed to fetch audio");
    }
  });

  // Fetch models dynamically from provider source
  app.post("/api/models/:provider", async (req, res) => {
    const { provider } = req.params;
    const { apiKey } = req.body;

    const serverKey = 
      provider === 'groq' ? getEnvKey(process.env.GROQ_API_KEY) :
      provider === 'openrouter' ? getEnvKey(process.env.OPENROUTER_API_KEY) :
      provider === 'mistral' ? getEnvKey(process.env.MISTRAL_API_KEY) :
      provider === 'routeway' ? getEnvKey(process.env.ROUTEWAY_API_KEY) :
      provider === 'deepseek' ? getEnvKey(process.env.DEEPSEEK_API_KEY) : 
      provider === 'gemini' ? (getEnvKey(process.env.API_KEY) || getEnvKey(process.env.GEMINI_API_KEY)) : '';

    const finalKey = getEnvKey(apiKey) || serverKey;

    if (!finalKey && provider !== 'openrouter' && provider !== 'routeway') {
      return res.status(401).json({ error: "مفتاح API غير متوفر لتحديث النماذج" });
    }

    try {
      let models: string[] = [];

      if (provider === 'gemini') {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${finalKey}`;
          const response = await fetch(url);
          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            console.error(`Gemini API returned status ${response.status} with body: ${errText}`);
            throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
          }
          const data: any = await response.json();
          if (data.models) {
            const apiModels = data.models
              .map((m: any) => m.name.replace('models/', ''))
              .filter((name: string) => (name.startsWith('gemini-') || name.startsWith('imagen-')) && !name.includes('embedding') && !name.includes('usecase'));
            models = [
              'gemini-3-flash-preview',
              'gemini-3.5-flash',
              'gemini-2.5-flash-image',
              ...apiModels
            ];
          }
        } catch (fetchError: any) {
          console.warn("Falling back to curated Gemini models list due to error:", fetchError.message || fetchError);
          // Standard high-quality models fallback list to avoid breaking the UI workflow on restricted keys
          models = [
            'gemini-3-flash-preview',
            'gemini-3.5-flash',
            'gemini-2.5-flash',
            'gemini-2.5-flash-image',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-2.0-pro-exp-02-05',
            'gemini-2.0-flash-thinking-exp-01-21',
          ];
        }
      } else if (provider === 'groq') {
        const response = await fetch(`https://api.groq.com/openai/v1/models`, {
          headers: { 'Authorization': `Bearer ${finalKey}` }
        });
        if (!response.ok) {
          throw new Error(`Groq API returned status ${response.status}`);
        }
        const data: any = await response.json();
        if (data.data) {
          models = data.data.map((m: any) => m.id);
        }
      } else if (provider === 'openrouter') {
        const response = await fetch(`https://openrouter.ai/api/v1/models`);
        if (!response.ok) {
          throw new Error(`OpenRouter API returned status ${response.status}`);
        }
        const data: any = await response.json();
        if (data.data) {
          models = data.data.map((m: any) => m.id);
        }
      } else if (provider === 'mistral') {
        const response = await fetch(`https://api.mistral.ai/v1/models`, {
          headers: { 'Authorization': `Bearer ${finalKey}` }
        });
        if (!response.ok) {
          throw new Error(`Mistral API returned status ${response.status}`);
        }
        const data: any = await response.json();
        if (data.data) {
          models = data.data.map((m: any) => m.id);
        }
      } else if (provider === 'deepseek') {
        const response = await fetch(`https://api.deepseek.com/v1/models`, {
          headers: { 'Authorization': `Bearer ${finalKey}` }
        });
        if (!response.ok) {
          throw new Error(`DeepSeek API returned status ${response.status}`);
        }
        const data: any = await response.json();
        if (data.data) {
          models = data.data.map((m: any) => m.id);
        }
      } else if (provider === 'routeway') {
        const response = await fetch(`https://api.routeway.ai/v1/models`, {
          headers: finalKey ? { 'Authorization': `Bearer ${finalKey}` } : {}
        });
        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`Routeway API returned status ${response.status}: ${errText.substring(0, 100)}`);
        }
        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`فشل تحليل استجابة Routeway (Invalid JSON).`);
        }
        if (data.data) {
          models = data.data.map((m: any) => m.id);
        }
      } else {
        return res.status(400).json({ error: "المزود غير مدعوم للتحديث التلقائي" });
      }

      // Filter empty, dedup, and sort
      models = Array.from(new Set(models.filter(m => !!m))).sort();

      if (models.length === 0) {
        throw new Error("لم يتم العثور على أي نماذج نشطة للمزود");
      }

      res.status(200).json({ models });
    } catch (error: any) {
      console.error(`Error fetching models for ${provider}:`, error);
      res.status(500).json({ error: error.message || "فشل جلب النماذج من المصدر" });
    }
  });

  // Proxy endpoint for AI providers (Mistral, Groq, OpenRouter, Routeway, etc.)
  app.post("/api/proxy/:provider", async (req, res) => {
    const { provider } = req.params;
    const { baseURL, apiKey, endpoint, ...body } = req.body;

    const payloadSize = JSON.stringify(req.body).length;
    if (payloadSize > 5 * 1024 * 1024) { // Log if > 5MB
      console.log(`Large payload detected for ${provider}: ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);
    }

    if (!baseURL) {
      return res.status(400).json({ error: "baseURL is required" });
    }

    const serverKey = 
      provider === 'groq' ? getEnvKey(process.env.GROQ_API_KEY) :
      provider === 'openrouter' ? getEnvKey(process.env.OPENROUTER_API_KEY) :
      provider === 'mistral' ? getEnvKey(process.env.MISTRAL_API_KEY) :
      provider === 'routeway' ? getEnvKey(process.env.ROUTEWAY_API_KEY) :
      provider === 'deepseek' ? getEnvKey(process.env.DEEPSEEK_API_KEY) : 
      provider === 'stability' ? getEnvKey(process.env.STABILITY_API_KEY) :
      provider === 'gemini' ? getFinalKey(process.env.GEMINI_API_KEY) : undefined;
    
    const finalKey = provider === 'gemini' 
      ? (getFinalKey(apiKey) || serverKey) 
      : (getEnvKey(apiKey) || serverKey || (['openrouter', 'routeway', 'pollinations'].includes(provider) ? 'free-access-key' : undefined));

    if (!finalKey) {
      console.error(`Missing API key for provider: ${provider}. apiKey from client: ${!!apiKey}, serverKey from env: ${!!serverKey}`);
      return res.status(401).json({ error: { message: `API key for ${provider} not found on server or client.` } });
    }

    try {
      console.log(`Proxying request to ${provider} (${baseURL}) for model ${body.model}`);
      
      // Determine the full URL. If baseURL already contains the endpoint, use it.
      // Otherwise, default to /chat/completions for text models.
      const isImageRequest = !!body.prompt && !body.messages;
      const defaultEndpoint = endpoint || (isImageRequest ? '/images/generations' : '/chat/completions');
      
      const fullURL = baseURL.includes('/images/generations') || baseURL.includes('/chat/completions') || baseURL.includes('/completions') 
        ? baseURL 
        : `${baseURL}${defaultEndpoint}`;

      const response = await fetch(fullURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalKey}`,
          'HTTP-Referer': (req.headers.origin as string) || (req.headers.referer as string) || 'https://ai.studio',
          'X-Title': 'Midad Al Rahman',
          'Accept': 'image/*' // Add Accept header for image providers
        },
        body: JSON.stringify(body)
      });

      const contentType = response.headers.get('content-type');
      if (contentType && (contentType.includes('image/') || contentType.includes('application/octet-stream'))) {
        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', contentType);
        res.send(Buffer.from(buffer));
        return;
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`Failed to parse JSON from ${provider}:`, responseText.substring(0, 200));
        return res.status(response.status).json({ 
          error: { message: `استجابة غير صالحة من المزود (Invalid JSON). الحالة: ${response.status}` },
          rawResponse: responseText.substring(0, 500)
        });
      }
      
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error(`Proxy error for ${provider}:`, error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Deep Research Endpoint
  app.post("/api/research", async (req, res) => {
    try {
      const { prompt, apiKey } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const keyToUse = getFinalKey(apiKey);
      if (!keyToUse) {
        return res.status(400).json({ error: "Gemini API Key is required" });
      }

      const ai = new GoogleGenAI({ apiKey: keyToUse });
      const candidateAgents = [
        'deep-research-preview-04-2026',
        'deep-research-pro-preview',
        'deep-research-preview',
        'deep-research-agent'
      ];

      let lastError: any = null;
      let interaction: any = null;

      for (const agentName of candidateAgents) {
        try {
          interaction = await ai.interactions.create({
            agent: agentName,
            input: prompt,
            background: true
          });
          if (interaction && interaction.id) {
            break;
          }
        } catch (err) {
          lastError = err;
        }
      }

      if (interaction && interaction.id) {
        return res.status(200).json({ interactionId: interaction.id, status: interaction.status });
      }

      throw lastError || new Error("Deep research agent unavailable");
    } catch (error: any) {
      console.error("Deep Research API Error:", error);
      res.status(500).json({ error: extractErrorMessage(error, "فشل بدء البحث العميق"), canFallback: true });
    }
  });

  // Deep Research Status Endpoint
  app.get("/api/research/status", async (req, res) => {
    try {
      const { interactionId, apiKey } = req.query;
      if (!interactionId) {
        return res.status(400).json({ error: "Interaction ID is required" });
      }

      const keyToUse = getFinalKey(apiKey as string);
      if (!keyToUse) {
        return res.status(400).json({ error: "Gemini API Key is required" });
      }

      const ai = new GoogleGenAI({ apiKey: keyToUse });
      const interaction = await ai.interactions.get(interactionId as string) as any;

      let fullReport = "";
      if (interaction.status === "completed" && interaction.steps) {
        for (const step of interaction.steps) {
          if (step.type === 'model_output') {
            const textContent = step.content?.find((c: any) => c.type === 'text');
            if (textContent) fullReport += textContent.text;
          }
        }
      }

      res.status(200).json({ 
        status: interaction.status, 
        text: fullReport, 
        error: interaction.error 
      });
    } catch (error: any) {
      console.error("Deep Research Status Error:", error);
      res.status(500).json({ error: extractErrorMessage(error, "فشل جلب حالة البحث العميق") });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const cwdDist = path.join(process.cwd(), 'dist');
    const distPath = fs.existsSync(path.join(cwdDist, 'index.html')) ? cwdDist : __dirname;
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Attach WebSocket Server for Gemini Live Realtime Audio API
  const wss = new WebSocketServer({ server, path: "/api/live" });

  wss.on("connection", async (clientWs, req) => {
    console.log("[WS Live] New client connected");

    const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const clientKey = urlObj.searchParams.get("apiKey");
    const voiceName = urlObj.searchParams.get("voice") || "Zephyr";
    const requestedModel = urlObj.searchParams.get("model") || "gemini-3.1-flash-live-preview";
    const finalKey = getFinalKey(clientKey || undefined);

    if (!finalKey) {
      clientWs.send(JSON.stringify({ type: 'error', error: "مفتاح Gemini API غير متاح على الخادم" }));
      clientWs.close();
      return;
    }

    const candidateModels = Array.from(new Set([
      requestedModel,
      "gemini-3.1-flash-live-preview",
      "gemini-2.5-flash-native-audio-latest",
      "gemini-3.5-live-translate-preview"
    ].filter(Boolean)));

    let session: any = null;
    let connectedModel = "";

    for (const modelName of candidateModels) {
      try {
        console.log(`[WS Live] Connecting Gemini Live session with model: ${modelName}, voice: ${voiceName}`);
        const ai = new GoogleGenAI({ apiKey: finalKey });

        session = await ai.live.connect({
          model: modelName,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName as any } }
            },
            systemInstruction: "أنت «مداد الرحمن» - القارئ والمقرئ المجود وخبير القراءات والتجويد والمكتبة الإسلامية. لديك القدرة الكاملة على تلاوة وترتيل وقراءة آيات القرآن الكريم، وشرح أحكام التجويد ومخارج الحروف، والرد على أسئلة العلوم الشرعية. لا تقل أبداً أنك لا تملك القدرة على القراءة أو أن دورك يقتصر على اختيار قراء آخرين؛ بل أنت مقرئ ومعلم وقارئ مجود مبارك. تتحدث بصوت فصيح ومطمئن باللغة العربية الفصحى. لديك القدرة الكاملة على رؤية شاشة المستخدم والتحكم في كل مفاصل التطبيق بدقة متناهية. \n\nعندما يطلب المستخدم تلاوة آية معينة أو تشغيل تلاوة لقارئ، يمكنك استخدام أداة control_app مع تحديد رقم السورة (surah) ورقم الآية (ayah) بدقة، وفي نفس الوقت قم بقراءة الآية وترتيلها بصوتك المقرئ الخاشع. \n\nمهامك تشمل:\n1. تلاوة وقراءة وترتيل آيات القرآن الكريم وشرح أحكام التجويد بدقة.\n2. تحليل شاشة المستخدم (إذا شاركها) ومساعدته في ما يقرأ.\n3. التحكم في التلاوة (تغيير السورة، الآية، القارئ).\n4. فتح الميزات (القبلة، المواقيت، التسبيح، إلخ).\n5. البحث في القرآن والحديث بذكاء.\n\nكن دقيقاً جداً في أرقام الآيات والسور. إذا طلب المستخدم تلاوة من الآية 13 من سورة معينة، تأكد من إرسال params: { surah: X, ayah: 13 }.",
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            tools: islamicTools as any
          },
          callbacks: {
            onmessage: async (message: LiveServerMessage) => {
              if (message.toolCall) {
                const toolResponses: any[] = [];
                for (const call of message.toolCall.functionCalls) {
                  console.log(`[WS Live] Model requested tool call: ${call.name}`, call.args);
                  const result = await executeIslamicTool(call.name, call.args, clientWs);
                  toolResponses.push({
                    name: call.name,
                    id: call.id,
                    response: { result }
                  });
                }
                session.sendRealtimeInput({
                  toolResponse: { functionResponses: toolResponses }
                });
                return;
              }

              const parts = message.serverContent?.modelTurn?.parts;
              if (parts && parts.length > 0) {
                for (const part of parts) {
                  if (part.inlineData?.data) {
                    clientWs.send(JSON.stringify({ type: 'audio', audio: part.inlineData.data }));
                  }
                  if (part.text) {
                    clientWs.send(JSON.stringify({ type: 'text', text: part.text }));
                  }
                }
              }
              if (message.serverContent?.interrupted) {
                clientWs.send(JSON.stringify({ type: 'interrupted' }));
              }
              if (message.serverContent?.turnComplete) {
                clientWs.send(JSON.stringify({ type: 'turnComplete' }));
              }
            },
            onerror: (err: any) => {
              console.error("[WS Live Session Error]", err);
              clientWs.send(JSON.stringify({ type: 'error', error: err?.message || "حدث خطأ في جلسة Gemini Live" }));
            },
            onclose: () => {
              console.log("[WS Live] Gemini session closed");
              clientWs.send(JSON.stringify({ type: 'closed' }));
            }
          }
        });

        connectedModel = modelName;
        clientWs.send(JSON.stringify({ type: 'connected', model: modelName }));
        break;
      } catch (err: any) {
        console.warn(`[WS Live] Model ${modelName} failed to connect:`, err?.message || err);
      }
    }

    if (!session) {
      clientWs.send(JSON.stringify({ type: 'error', error: "تعذر بدء محادثة الصوت المباشرة عبر Gemini Live حالياً." }));
      clientWs.close();
      return;
    }

    clientWs.on("message", (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
          });
        } else if (msg.image) {
          // Handle screen sharing frames
          session.sendRealtimeInput({
            media: { data: msg.image, mimeType: "image/jpeg" }
          });
        } else if (msg.text) {
          session.sendRealtimeInput({
            text: msg.text
          });
        }
      } catch (e) {
        console.error("[WS Live] Client message parse error:", e);
      }
    });

    clientWs.on("close", () => {
      console.log("[WS Live] Client disconnected");
      try {
        if (session) session.close();
      } catch (_) {}
    });
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
