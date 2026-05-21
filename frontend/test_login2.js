const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const jar = new CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true, maxRedirects: 10 }));

async function run() {
  try {
    const res1 = await client.get('https://i.sjtu.edu.cn/jaccountlogin');
    const loginUrl = res1.request.res.responseUrl;
    
    const params = new URLSearchParams();
    params.append('user', 'yddd19952193983');
    params.append('pass', '20050018zxs');
    
    console.log("POSTing to", loginUrl);
    const res2 = await client.post(loginUrl, params.toString(), {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    console.log("Post Response URL:", res2.request.res.responseUrl);
    const res3 = await client.get('https://i.sjtu.edu.cn/kbcx/xskbcx_cxXsKb.html');
    require('fs').writeFileSync('course.html', res3.data);
    console.log('Final URL:', res3.request.res.responseUrl, 'Length:', res3.data.length);
    console.log("Success! check course.html");
  } catch(e) { console.error(e.message); }
}
run();