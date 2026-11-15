async function run() {
  try {
    const res = await fetch('https://api.quran.com/api/v4/resources/recitations?language=ar');
    const data = await res.json();
    console.log(data.recitations.length);
  } catch (e) {
    console.log(e.message);
  }
}
run();
