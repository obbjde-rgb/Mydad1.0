import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const oldCatch = `        } catch (e: any) {
          lastError = e;
          const errMsg = String(e?.message || e);
          console.warn(\`[Generate] Model \${currentAttempt.model} failed:\`, errMsg);
          if (errMsg.includes("401")) break; 
          if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }`;

const newCatch = `        } catch (e: any) {
          lastError = e;
          const errMsg = String(e?.message || e);
          console.warn(\`[Generate] Model \${currentAttempt.model} failed:\`, errMsg);
          if (errMsg.includes("401")) break; 
          if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            let delayMs = 1000;
            const match = errMsg.match(/retry in ([\d\.]+)s/);
            if (match && match[1]) {
              delayMs = Math.ceil(parseFloat(match[1])) * 1000 + 1000;
            }
            console.warn(\`[Generate] Rate limited. Waiting \${delayMs}ms...\`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }`;

content = content.replace(oldCatch, newCatch);

const oldStreamCatch = `        } catch (e: any) {
          lastError = e;
          const errMsg = String(e?.message || e);
          console.warn(\`[Stream] Model \${currentAttempt.model} failed:\`, errMsg);
          if (res.headersSent) throw e;
          if (errMsg.includes("401")) break;
          if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }`;

const newStreamCatch = `        } catch (e: any) {
          lastError = e;
          const errMsg = String(e?.message || e);
          console.warn(\`[Stream] Model \${currentAttempt.model} failed:\`, errMsg);
          if (res.headersSent) throw e;
          if (errMsg.includes("401")) break;
          if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            let delayMs = 1000;
            const match = errMsg.match(/retry in ([\d\.]+)s/);
            if (match && match[1]) {
              delayMs = Math.ceil(parseFloat(match[1])) * 1000 + 1000;
            }
            console.warn(\`[Stream] Rate limited. Waiting \${delayMs}ms...\`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }`;

content = content.replace(oldStreamCatch, newStreamCatch);

fs.writeFileSync('server.ts', content);
