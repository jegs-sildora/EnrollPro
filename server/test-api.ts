import axios from 'axios';
async function test() {
  const res = await axios.get('http://localhost:5173/api/settings/public');
  console.log(res.data);
}
test().catch(console.error);
