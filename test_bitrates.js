async function run() {
  try {
    const res = await fetch('https://api.alquran.cloud/v1/edition/format/audio');
    const data = await res.json();
    const reciters = [
      'ar.alafasy', 'ar.abdullahbasfar', 'ar.abdurrahmaansudais', 'ar.mahermuaiqly',
      'ar.husary', 'ar.husarymujawwad', 'ar.minshawi', 'ar.minshawimujawwad',
      'ar.shaatree', 'ar.ahmedajamy', 'ar.saoodshuraym', 'ar.hudhaify',
      'ar.abdulbasitmurattal', 'ar.abdulsamad', 'ar.muhammadayyoub', 'ar.muhammadjibreel',
      'ar.aymanswoaid', 'ar.hanirifai', 'ar.ibrahimakhbar', 'ar.parhizgar',
      'ar.yasseraddussary', 'ar.faresabbad', 'ar.nasseralqatami', 'ar.salahalbudair',
      'ar.alijaber', 'ar.mahmoudalialbanna', 'ar.mustafaismail',
      'en.walk', 'fa.hedayatfarfooladvand', 'fr.leclerc', 'ru.kuliev-audio',
      'ur.khan', 'zh.chinese'
    ];
    
    for (const r of reciters) {
      if (data.data.find(e => e.identifier === r)) {
        try {
          const res2 = await fetch(`https://api.alquran.cloud/v1/ayah/1/${r}`);
          const data2 = await res2.json();
          if (data2.data && data2.data.audio) {
            const url = data2.data.audio;
            const match = url.match(/\/audio\/(\d+)\//);
            console.log(r, match ? match[1] : 'unknown');
          } else {
            console.log(r, 'no audio field');
          }
        } catch (e) {
          console.log(r, 'error fetching ayah');
        }
      } else {
        console.log(r, 'not found in API');
      }
    }
  } catch (e) {
    console.log(e.message);
  }
}
run();
