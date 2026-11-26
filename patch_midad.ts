import fs from 'fs';

let content = fs.readFileSync('src/components/MidadAlRahman.tsx', 'utf-8');

const oldSendMessage = `  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    setAudioUrls(prev => { const next = {...prev}; delete next['all']; return next; });
    const userMessage: AIMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);`;

const newSendMessage = `  const sendMessage = async (text: string, inlineData?: { data: string, mimeType: string, filename: string }) => {
    if (!text.trim() && !inlineData) return;

    setAudioUrls(prev => { const next = {...prev}; delete next['all']; return next; });
    const userMessage: AIMessage = { role: 'user', content: text, inlineData };
    setMessages(prev => [...prev, userMessage]);`;

content = content.replace(oldSendMessage, newSendMessage);

fs.writeFileSync('src/components/MidadAlRahman.tsx', content);
