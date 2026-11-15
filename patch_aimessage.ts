import fs from 'fs';

let content = fs.readFileSync('src/services/aiService.ts', 'utf-8');

content = content.replace(
`  isDeepResearch?: boolean;
  suggestions?: string[];
};`,
`  isDeepResearch?: boolean;
  suggestions?: string[];
  inlineData?: { data: string, mimeType: string, filename?: string };
};`
);

fs.writeFileSync('src/services/aiService.ts', content);
