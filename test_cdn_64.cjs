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
    'fa.hedayatfarfooladvand',
    'ur.khan'
  ];
  
  for (const r of reciters) {
    const url64 = `https://cdn.islamic.network/quran/audio/64/${r}/1.mp3`;
    const res64 = await checkUrl(url64);
    console.log(r, 'CDN 64:', res64.status);
  }
}
run();
