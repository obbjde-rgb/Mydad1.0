async function run() {
  try {
    const res = await fetch('https://api.alquran.cloud/v1/edition/format/audio');
    const data = await res.json();
    console.log(data.data.map(e => e.identifier).join('\n'));
  } catch (e) {
    console.log(e.message);
  }
}
run();
