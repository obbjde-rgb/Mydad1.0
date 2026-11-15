export const islamicToolsSchema = [
  {
    name: "get_tajweed_verse",
    description: "Fetch a specific verse from the Quran with Tajweed annotations (XML tags). Use this when the user asks for Tajweed rules for a specific verse.",
    parameters: {
      type: "OBJECT",
      properties: {
        surah: { type: "INTEGER", description: "Surah number (1-114)" },
        ayah: { type: "INTEGER", description: "Ayah number" }
      },
      required: ["surah", "ayah"]
    }
  },
  {
    name: "search_hadith_advanced",
    description: "Search for hadiths across multiple books. Returns authentic hadiths with their grading.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "The keyword to search for in Arabic." },
        book: { type: "STRING", description: "Optional: The book to search in (e.g., 'bukhari', 'muslim')." }
      },
      required: ["query"]
    }
  }
];

export const getTajweedVerse = async (surah: number, ayah: number) => {
  try {
    const response = await fetch(`https://api.quran.com/api/v4/verses/by_key/${surah}:${ayah}?fields=text_uthmani_tajweed`);
    const data = await response.json();
    if (data.verse && data.verse.text_uthmani_tajweed) {
      return {
        surah,
        ayah,
        tajweed_text: data.verse.text_uthmani_tajweed
      };
    }
  } catch (e) {
    console.error("Failed to fetch tajweed", e);
  }
  return null;
};
