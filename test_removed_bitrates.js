async function run() {
  try {
    const res = await fetch('https://api.alquran.cloud/v1/edition/format/audio');
    const data = await res.json();
    const reciters = [
      'ar.yasseraddussary', 'ar.faresabbad', 'ar.nasseralqatami', 'ar.salahbukhatir',
      'ar.khalifaaltunaiji', 'ar.abdullahmatrood', 'es.cortes', 'de.bubenheim',
      'tr.ates', 'bs.korkut', 'pt.portuguese', 'id.indonesian'
    ];
    
    for (const r of reciters) {
      const edition = data.data.find(e => e.identifier === r);
      if (edition) {
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
