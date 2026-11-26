import fs from 'fs';

let content = fs.readFileSync('src/components/chat/ChatInput.tsx', 'utf-8');

content = content.replace(
`<div className="flex-1 relative min-w-0">
          <div className="flex flex-col flex-1 relative">`,
`<div className="flex flex-col flex-1 relative min-w-0">`
);

fs.writeFileSync('src/components/chat/ChatInput.tsx', content);
