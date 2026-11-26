import { GoogleGenAI } from "@google/genai";
try {
  const ai = new GoogleGenAI({ apiKey: "dummy", apiVersion: 'v1beta' });
  console.log("Success", ai);
} catch (e) {
  console.error("Error", e);
}
