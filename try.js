const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
    const id = 235647;
    const question = 10;

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        userDataDir: "C:\\Users\\ferre_roc1fyd\\AppData\\Local\\Google\\Chrome\\User Data\\PuppeteerProfile",
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Add stability
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const cookiesFilePath = "cookies.json";
    if (fs.existsSync(cookiesFilePath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesFilePath, "utf8"));
        await page.setCookie(...cookies);
    }

    const courseURL = `http://localhost/automate/questions.php`;
    await page.goto(courseURL, { waitUntil: "networkidle2", timeout: 60000 });

    // Function to fetch answer from the AI API
    async function getAIAnswer(prompt) {
        const apiKey = 'AIzaSyB43n_ZMgajhuPxyKegvuT3UTPko5B4iLo';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [ 
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
            }

            const data = await response.json();
            const aiResponse = data.candidates[0].content.parts[0].text.trim().toLowerCase();

            if (["a", "b", "c", "d"].includes(aiResponse)) {
                return aiResponse;
            } 
            else {
                console.error(`Invalid AI response: "${aiResponse}". Defaulting to 'd'.`);
                return "d";
            }
        } catch (error) {
            console.error('Error fetching AI answer:', error.message);
            return "d";
        }
    }

    // Map letter answers to numeric values based on HTML structure
    const answerMap = { 'a': '0', 'b': '1', 'c': '2', 'd': '3' };

    // Track processed questions to avoid infinite loops
    const processedQuestions = new Set();
    let hasNextPage = true;
    let pageCount = -1;
    const maxPages = 10; // Safety limit to prevent infinite loops

    while (hasNextPage && pageCount < maxPages) {
        pageCount++;
        console.log(`Processing page ${pageCount}`);

        const questions = await page.$$eval('.que', questionElements => {
            return questionElements.map(questionEl => {
                const questionText = questionEl.querySelector('.qtext')?.textContent.trim();

                const options = Array.from(questionEl.querySelectorAll('.answer > div')).map((el, index) => {
                    const label = el.querySelector('.flex-fill')?.textContent.trim();
                    const input = el.querySelector('input[type="radio"]');
                    const value = input?.getAttribute('value');
                    const name = input?.getAttribute('name');
                    return { letter: String.fromCharCode(97 + index), label, value, name };
                });

                const questionId = options[0]?.name.split('_')[0]; // e.g., "q29432467:7"
                return { questionText, options, questionId };
            });
        });

        for (const { questionText, options, questionId } of questions) {
            if (processedQuestions.has(questionText)) {
                console.log(`Detected repeated question: "${questionText}". Stopping loop.`);
                hasNextPage = false;
                break;
            }
            processedQuestions.add(questionText);

            console.log(`Question: ${questionText}`);
            console.log('Options:', options);

            const optionsText = options.map(opt => `${opt.letter}) ${opt.label}`).join(' ');
            const aiPrompt = `${questionText} ${optionsText} Please respond with only one letter: 'a', 'b', 'c', or 'd'.`;

            const answer = await getAIAnswer(aiPrompt);
            console.log(`AI selected answer: ${answer}`);

            let answerValue;
            if (["a", "b", "c", "d"].includes(answer)) {
                answerValue = answerMap[answer];
            } else {
                console.error(`Invalid AI response: "${answer}". Defaulting to 'd'.`);
                answerValue = answerMap['d'];
            }

            if (answerValue !== undefined) {
                const escapedQuestionId = questionId.replace(':', '\\:');
                const selector = `#${escapedQuestionId}_answer${answerValue}`;
                console.log(`Attempting to select: ${selector}`);

                try {
                    const elementExists = await page.$(selector);
                    if (elementExists) {
                        await page.waitForSelector(selector, { timeout: 15000 });
                        await page.click(selector);
                        console.log(`Selected answer: ${answer} (value: ${answerValue})`);
                    } else {
                        console.error(`Selector ${selector} not found on the page. Page URL: ${page.url()}`);
                    }
                } catch (error) {
                    console.error(`Error selecting element with selector ${selector}: ${error.message}`);
                    hasNextPage = false; // Stop if we encounter a frame detachment
                    break;
                }
            } else {
                console.error(`Answer mapping failed for: ${answer}`);
            }
        }

        if (!hasNextPage) break;

        const nextButton = await page.$('#mod_quiz-next-nav');
        if (nextButton) {
            try {
                // Click the button and wait for navigation or DOM update
                const navigationPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.click('#mod_quiz-next-nav');
                console.log('Form submitted, proceeding to next page...');

                try {
                    await navigationPromise;
                } catch (error) {
                    console.warn('Navigation did not complete, checking for DOM update...');
                    // If navigation fails, check if the DOM updated (e.g., new question appeared)
                    await page.waitForFunction(
                        (prevQuestion) => {
                            const currentQuestion = document.querySelector('.qtext')?.textContent.trim();
                            return currentQuestion && currentQuestion !== prevQuestion;
                        },
                        { timeout: 30000 },
                        questions[0]?.questionText || ''
                    );
                }
            } catch (error) {
                console.error(`Navigation error: ${error.message}`);
                hasNextPage = false;
            }
        } else {
            console.log('No more pages to process.');
            hasNextPage = false;
        }
    }

    if (pageCount >= maxPages) {
        console.log(`Reached maximum page limit (${maxPages}). Stopping.`);
    }

    // Close the browser
    console.log('Browser closed.');
})();