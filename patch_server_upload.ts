import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const oldContents = `          const contents = messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }));`;

const newContents = `          const contents = messages.filter((m: any) => m.role !== 'system').map((m: any) => {
            const parts: any[] = [];
            if (m.inlineData) {
              parts.push({ inlineData: m.inlineData });
            }
            if (m.content) {
              parts.push({ text: m.content });
            }
            return {
              role: m.role === 'assistant' ? 'model' : 'user',
              parts
            };
          });`;

content = content.replace(oldContents, newContents);
content = content.replace(oldContents, newContents); // replace both occurrences

fs.writeFileSync('server.ts', content);
