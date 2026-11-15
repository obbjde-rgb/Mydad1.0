async function run() {
  try {
    const res = await fetch('https://mirrors.quranicaudio.com/everyayah/');
    const html = await res.text();
    const matches = html.match(/href="([^"]+\/)"/g);
    if (matches) {
      const folders = matches.map(m => m.replace('href="', '').replace('"', ''));
      console.log(folders.filter(f => f.toLowerCase().includes('yasser') || f.toLowerCase().includes('fares') || f.toLowerCase().includes('nasser') || f.toLowerCase().includes('salah') || f.toLowerCase().includes('khalifa') || f.toLowerCase().includes('matrood') || f.toLowerCase().includes('spanish') || f.toLowerCase().includes('german') || f.toLowerCase().includes('turkish') || f.toLowerCase().includes('bosnian') || f.toLowerCase().includes('portuguese') || f.toLowerCase().includes('indonesian')).join('\n'));
    }
  } catch (e) {
    console.log(e.message);
  }
}
run();
