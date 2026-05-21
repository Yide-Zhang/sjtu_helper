const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const fs = require('fs');

const jar = new CookieJar();
const client = wrapper(axios.create({ 
  jar, 
  withCredentials: true,
  maxRedirects: 5 
}));

async function run() {
  const username = 'yddd19952193983';
  const password = '20050018zxs'; // using creds from jaccount.txt
  
  try {
    console.log('1. Fetching jaccountlogin...');
    const res1 = await client.get('https://i.sjtu.edu.cn/jaccountlogin');
    const html1 = res1.data;
    
    const execMatch = html1.match(/name="execution"\s+value="([^"]+)"/i);
    const execution = execMatch ? execMatch[1] : '';
    console.log('Execution token:', execution);
    
    const urlObj = new URL(res1.request.res.responseUrl);
    const loginUrl = res1.request.res.responseUrl;
    
    console.log('2. Posting login credentials...');
    const params = new URLSearchParams();
    params.append('user', username);
    params.append('pass', password);
    params.append('captcha', '');
    params.append('execution', execution);
    params.append('_eventId', 'submit');
    
    const res2 = await client.post(loginUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    console.log('3. Login request response URL:', res2.request.res.responseUrl);
    
    console.log('4. Fetching course HTML...');
    const res3 = await client.get('https://i.sjtu.edu.cn/kbcx/xskbcx_cxXsKb.html');
    
    fs.writeFileSync('test_output.html', res3.data);
    console.log('Final HTML length:', res3.data.length);
    console.log('Output saved to test_output.html');
    
  } catch(e) {
    console.error('Error during test:', e.message);
    if(e.response) {
      console.log('Error status:', e.response.status);
    }
  }
}
run();