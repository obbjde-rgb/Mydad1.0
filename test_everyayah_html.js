async function run() {
  try {
    const res = await fetch('https://everyayah.com/');
    const html = await res.text();
    console.log(html.substring(0, 500));
    
    // The reciters are usually in a <select> dropdown
    const matches = html.match(/<option value="([^"]+)">/g);
    if (matches) {
      console.log('Found options:', matches.length);
      const values = matches.map(m => m.replace('<option value="', '').replace('">', ''));
      console.log(values.filter(v => v.toLowerCase().includes('yasser') || v.toLowerCase().includes('fares') || v.toLowerCase().includes('nasser') || v.toLowerCase().includes('salah') || v.toLowerCase().includes('khalifa') || v.toLowerCase().includes('matrood') || v.toLowerCase().includes('spanish') || v.toLowerCase().includes('german') || v.toLowerCase().includes('turkish') || v.toLowerCase().includes('bosnian') || v.toLowerCase().includes('portuguese') || v.toLowerCase().includes('indonesian')).join('\n'));
    }
  } catch (e) {
    console.log(e.message);
  }
}
run();
