const puppeteer = require("puppeteer");

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        userDataDir: "C:\\Users\\ferre_roc1fyd\\AppData\\Local\\Google\\Chrome\\User Data\\PuppeteerProfile"
    });

    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto("https://bcp-sms.elearningcommons.com/student-module", { waitUntil: "networkidle2" });
    const loginExists = await page.$("input#username");

    if (loginExists) {
        await page.type("input#username", "s21017488", { delay: 50 });
        await page.type("input#password", "#Fe8080", { delay: 50 });
        await page.click("button.mat-flat-button");
        await page.waitForNavigation({ waitUntil: "networkidle2" });
    }

    // await page.waitForTimeout(5000);
    // await browser.close();

})();

