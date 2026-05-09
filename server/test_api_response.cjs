const axios = require("axios");

async function main() {
  const ayId = 4;
  try {
    const res = await axios.get(`http://localhost:5001/api/sections/${ayId}`, {
        // Need token, but maybe I can check the code instead
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}

// main();
