const axios = require('axios');

module.exports = async function (x, fb_scrap) {
  try {
    let coc;

    if (typeof x === 'string' && x.includes('=') && x.includes(';')) {
      coc = x;
    } else if (typeof x === 'object') {
      const cookies = x;
      if (!Array.isArray(cookies)) {
        throw new Error("Invalid cookie format");
      }
      coc = cookies.map(cookie => `${cookie.key}=${cookie.value}`).join('; ');
    } else {
      const cookies = JSON.parse(x);
      if (!Array.isArray(cookies)) {
        throw new Error("Invalid cookie format");
      }
      coc = cookies.map(cookie => `${cookie.key}=${cookie.value}`).join('; ');
    }

    const response = await axios.get('https://facebook.com/settings/', {
      headers: { cookie: coc }
    });
    if (fb_scrap) {
      if (response.data.match(/(ScrapingWarning|fb_scraping_warning)/i)) return {status: true};
      return {status: false};
    }
    
    let r;

    if (response.data.match(/Your account is not visible|it will be permanently disabled/)) {
      r = { error: "your account is suspended" };
    } else if (response.data.match(/href="https:\/\/www\.facebook\.com\/login\/web\/"/)) {
      r = { error: "not logged in. invalid cookies." };
    } else if (response.data.match(/"logged_in"/)) {
      r = { success: "Valid cookies." };
    } else {
      r = { error: "Invalid cookies." };
    }

    return r;
  } catch (error) {
    return { error: error.message };
  }
};
