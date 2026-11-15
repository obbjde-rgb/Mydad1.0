async function run() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/GlobalQuran/everyayah/master/data/reciters.json');
    if (res.ok) {
      const data = await res.json();
      console.log(data);
    } else {
      console.log('Not found on github');
    }
  } catch (e) {
    console.log(e.message);
  }
}
run();
