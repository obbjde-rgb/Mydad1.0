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
  const folders = [
    'MultiLanguage/English/Ibrahim_Walk_192kbps_TR',
    'MultiLanguage/Persian/Hedayatfar_40kbps',
    'French/Leclerc_128kbps',
    'Russian/Russian_128kbps',
    'MultiLanguage/Urdu/Shamshad_Ali_Khan_48kbps',
    'Chinese/Chinese_128kbps'
  ];
  
  for (const f of folders) {
    const url = `https://everyayah.com/data/${f}/001001.mp3`;
    const res = await checkUrl(url);
    console.log(f, 'EveryAyah:', res.status);
  }
}
run();
