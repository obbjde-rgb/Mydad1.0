async function run() {
  try {
    const reciters = ['ur.khan', 'zh.chinese', 'ar.hudhaify'];
    for (const r of reciters) {
      const res2 = await fetch(`https://api.alquran.cloud/v1/ayah/2/${r}`);
      const data2 = await res2.json();
      if (data2.data && data2.data.audio) {
        const url = data2.data.audio;
        const match = url.match(/\/audio\/(\d+)\//);
        console.log(r, match ? match[1] : 'unknown');
      } else {
        console.log(r, 'no audio field');
      }
    }
  } catch (e) {
    console.log(e.message);
  }
}
run();
