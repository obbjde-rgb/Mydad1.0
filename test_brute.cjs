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
    'Salah_Bukhatir_128kbps',
    'Salah_Bukhatir_64kbps',
    'Salah_Bukhatir_192kbps',
    'Salah_Bukhatir_48kbps',
    'Salah_Bukhatir_32kbps',
    'Salah_Bukhatir_16kbps',
    'salah_bukhatir_128kbps',
    'Salah_Bukhatir_Murattal_128kbps',
    'Khalifa_Al_Tunaiji_64kbps',
    'Khalifa_Al_Tunaiji_128kbps',
    'Abdullah_Matrood_128kbps',
    'Abdullah_Matrood_64kbps',
    'MultiLanguage/Spanish/Cortes_128kbps',
    'MultiLanguage/Spanish/Cortes_64kbps',
    'MultiLanguage/German/Bubenheim_128kbps',
    'MultiLanguage/Turkish/Ates_128kbps',
    'MultiLanguage/Bosnian/Korkut_128kbps',
    'MultiLanguage/Portuguese/Portuguese_128kbps',
    'MultiLanguage/Indonesian/Indonesian_128kbps'
  ];
  
  for (const f of folders) {
    const url = `https://everyayah.com/data/${f}/001001.mp3`;
    const res = await checkUrl(url);
    if (res.status === 200) {
      console.log(f, 'FOUND!');
    }
  }
}
run();
