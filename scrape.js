// scrape.js
const puppeteer = require('puppeteer');
const fs = require('fs');

const TARGET_URL = 'https://anizone.to/anime'; // <-- change this

function randomString(length = 3) {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
  });

  const page = await browser.newPage();

  let matchedRequest = null;

  // Start listening BEFORE interacting with the page
  const responsePromise = new Promise((resolve) => {
    page.on('request', (request) => {
      try {
        const url = new URL(request.url());

        if (url.pathname === '/livewire/update') {
          matchedRequest = request;

          console.log('Found request:', request.url());
        }
      } catch {}
    });

    page.on('response', async (response) => {
      if (!matchedRequest) return;

      if (response.request() !== matchedRequest) return;

      let body;
let videoOBJ
      try {
        body = await response.text();
        const goodRes = await response.json();
        const goodURL=
          goodRes?.components[0]?.effects?.dispatches[0]?.params?.items[1]?.url;

         videoOBJ=  await scrapeVideoData(goodURL+'/1');
       
        async function scrapeVideoData(url) {
          const res = await fetch(url);

          if (!res.ok) {
            throw new Error(`Failed to fetch ${url}: ${res.status}`);
          }

          const html = await res.text();
          const marker = `x-data="vidstackPlayer(JSON.parse('`;

          const start = html.indexOf(marker);
          console.log(start);

          if (start === -1) {
            return null;
          }

          const valueStart = start + marker.length;
          let valueEnd = html.indexOf(`'))"`, valueStart);

          if (valueEnd === -1) {
            // return null;
           valueEnd = html.indexOf(344367+100, valueStart);
          }

          const rawValue = html.slice(valueStart, valueEnd);

          // Decode the JavaScript string escapes:
          // \u0022 -> "
          // \\/     -> \/
          // etc.
          const jsonString = decodeJsString(rawValue);
          // console.log(JSON.parse(jsonString))

          // Now parse the actual JSON
          return JSON.parse(jsonString);
        }

        function decodeJsString(value) {
          // Turn the contents of the JS single-quoted string into something
          // JSON.parse can decode as a string.
          return JSON.parse(
            `"${value.replace(/"/g, '\\"').replace(/\\'/g, "'")}"`,
          );
        }
      } catch (err) {
        body = `[Could not read response body: ${err.message}]`;
      }

      resolve({
        request: {
          url: matchedRequest.url(),
          method: videoOBJ,
          // headers: matchedRequest.headers(),
          payload: matchedRequest.postData(),
        },

        // response: {
        //   status: response.status(),
        //   headers: response.headers(),
        //   body,
        // },
      });
    });
  });

  console.log('Opening:', TARGET_URL);

  await page.goto(TARGET_URL, {
    waitUntil: 'networkidle2',
  });

  const selector = 'input.border-slate-700';

  await page.waitForSelector(selector);

  const randomValue = 'naruto';

  console.log('Typing:', randomValue);

  // Clear existing value
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');

  // Type random characters
  await page.type(selector, randomValue, {
    delay: 100,
  });

  console.log('Waiting for /livewire/update...');

  const captured = await responsePromise;

  const output = {
    typedValue: randomValue,
    capturedAt: new Date().toISOString(),
    ...captured,
  };

  fs.writeFileSync('livewire-capture.json', JSON.stringify(output, null, 2));

  // console.log('\nCaptured successfully!');
  // console.log(JSON.stringify(output, null, 2));
  // console.log('\nSaved to livewire-capture.json');

  await browser.close();
})();
