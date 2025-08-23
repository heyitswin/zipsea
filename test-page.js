const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Listen for console messages
    page.on('console', msg => {
      console.log(`BROWSER: ${msg.text()}`);
    });
    
    // Listen for network requests
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`API REQUEST: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`API RESPONSE: ${response.status()} ${response.url()}`);
      }
    });
    
    console.log('Visiting page...');
    await page.goto('http://localhost:3002/cruise/symphony-of-the-seas-2025-10-05-2143102', {
      waitUntil: 'networkidle0',
      timeout: 10000
    });
    
    // Wait a bit more for any async operations
    await page.waitForTimeout(3000);
    
    // Check if the page has loaded content
    const pageContent = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log('\n--- PAGE CONTENT ---');
    console.log(pageContent.slice(0, 500));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
})();