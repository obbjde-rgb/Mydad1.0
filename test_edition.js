async function run() {
  try {
    const res = await fetch('https://api.alquran.cloud/v1/edition/format/audio');
    const data = await res.json();
    const editions = data.data.filter(e => ['en.walk', 'fa.hedayatfarfooladvand'].includes(e.identifier));
    console.log(JSON.stringify(editions, null, 2));
  } catch (e) {
    console.log(e.message);
  }
}
run();
