const https = require('https');

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve({ url, status: res.statusCode });
    }).on('error', (e) => {
      resolve({ url, error: e.message });
    });
  });
}

async function run() {
  const reciters = [
    'en.walk',
    'fr.leclerc',
    'ru.kuliev-audio',
    'fa.hedayatfarfooladvand',
    'ur.khan',
    'zh.chinese'
  ];
  
  for (const r of reciters) {
    const url = `https://cdn.islamic.network/quran/audio/128/${r}/1.mp3`;
    const res = await checkUrl(url);
    console.log(r, 'CDN:', res.status);
  }
}
run();
