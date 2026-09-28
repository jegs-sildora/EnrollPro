import axios from 'axios';
async function test() {
  try {
    const res = await axios.put('http://localhost:3000/api/system/date-override', {
      mockedDate: '2023-09-15T16:00:00.000Z'
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}
test();
