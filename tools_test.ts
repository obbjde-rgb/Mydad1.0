export const islamicTools = [{
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
    }
  ]
}];

export async function executeIslamicTool(name: string, args: any) {
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
