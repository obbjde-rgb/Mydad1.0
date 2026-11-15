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
  const url = `https://cdn.islamic.network/quran/audio/40/fa.hedayatfarfooladvand/1.mp3`;
  const res = await checkUrl(url);
  console.log('fa.hedayatfarfooladvand 40kbps:', res.status);
}
run();
