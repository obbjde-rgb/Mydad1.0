async function run() {
  try {
    const res = await fetch('https://api.quran.com/api/v4/resources/recitations');
    const data = await res.json();
    console.log(data.recitations.map(r => r.translated_name.name + ' - ' + r.style).join('\n'));
  } catch (e) {
    console.log(e.message);
  }
}
run();
