async function run() {
  try {
    const res = await fetch('https://mp3quran.net/api/v3/reciters?language=ar');
    const data = await res.json();
    const reciters = data.reciters.filter(r => 
      r.name.includes('صلاح بوخاطر') || 
      r.name.includes('خليفة الطنيجي') || 
      r.name.includes('عبد الله مطرود') ||
      r.name.includes('عبدالله مطرود')
    );
    console.log(JSON.stringify(reciters, null, 2));
  } catch (e) {
    console.log(e.message);
  }
}
run();
