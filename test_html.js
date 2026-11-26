async function run() {
  try {
    const res = await fetch('https://mirrors.quranicaudio.com/everyayah/');
    const html = await res.text();
    console.log(html.substring(0, 2000));
  } catch (e) {
    console.log(e.message);
  }
}
run();
