async function run() {
  try {
    const res = await fetch('https://mirrors.quranicaudio.com/everyayah/');
    const html = await res.text();
    const matches = html.match(/href="([^"]+\/)"/g);
    if (matches) {
      const folders = matches.map(m => m.replace('href="', '').replace('"', ''));
      console.log(folders.filter(f => f.toLowerCase().includes('bukhatir') || f.toLowerCase().includes('khalifa') || f.toLowerCase().includes('matrood')).join('\n'));
    }
  } catch (e) {
    console.log(e.message);
  }
}
run();
