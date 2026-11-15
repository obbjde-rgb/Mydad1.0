async function run() {
  try {
    const res = await fetch('https://api.alquran.cloud/v1/ayah/1/en.walk');
    const data = await res.json();
    console.log(data.data.audio);
    console.log(data.data.audioSecondary);
    
    const res2 = await fetch('https://api.alquran.cloud/v1/ayah/1/fa.hedayatfarfooladvand');
    const data2 = await res2.json();
    console.log(data2.data.audio);
    console.log(data2.data.audioSecondary);
  } catch (e) {
    console.log(e.message);
  }
}
run();
