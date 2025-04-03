const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
    const id = 235656;
    const maxQuestions = 11; 

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        userDataDir: "C:\\Users\\ferre_roc1fyd\\AppData\\Local\\Google\\Chrome\\User Data\\PuppeteerProfile",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const cookiesFilePath = "cookies.json";
    if (fs.existsSync(cookiesFilePath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesFilePath, "utf8"));
        await page.setCookie(...cookies);
    }

    await page.goto("https://bcpeducollege.elearningcommons.com/login/index.php", { waitUntil: "networkidle2" });
    if ((await page.$("#username")) !== null) {
        // await page.type("#username", "your-username", { delay: 50 });
        await page.type("#password", "#Fe8080", { delay: 50 });

        await Promise.all([
            page.click("#loginbtn"),
            page.waitForNavigation({ waitUntil: "networkidle2" }),
        ]);

        const cookies = await page.cookies();
        fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies, null, 2));
    }

    const courseURL = `https://bcpeducollege.elearningcommons.com/mod/quiz/view.php?id=${id}`;
    await page.goto(courseURL, { waitUntil: "networkidle2", timeout: 60000 });

    const sesskey = await page.evaluate(() => {
        const sesskeyElement = document.querySelector('input[name="sesskey"]');
        return sesskeyElement ? sesskeyElement.value : "x7sgjicg4p";
    });

    const startAttemptURL = `https://bcpeducollege.elearningcommons.com/mod/quiz/startattempt.php?cmid=${id}&sesskey=${sesskey}&_qf__mod_quiz_form_preflight_check_form=1&submitbutton=Start%20attempt&x=Cancel`;
    await page.goto(startAttemptURL, { waitUntil: "networkidle2", timeout: 60000 });

    // const submitButtonSelector = 'input[name="submitbutton"][value="Start attempt"]';
    // try {
    //     await page.waitForSelector(submitButtonSelector, { visible: true, timeout: 30000 });
    //     await Promise.all([
    //         page.click(submitButtonSelector),
    //         page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
    //     ]);
    //     console.log("Quiz Attempt URL:", page.url());
    // } catch (error) {
    //     console.error(`Error finding or clicking "${submitButtonSelector}": ${error.message}`);
    //     const pageContent = await page.content();
    //     fs.writeFileSync("debug_page.html", pageContent);
    //     console.log("Page content saved to debug_page.html for inspection.");

    //     const fallbackButton = await page.$x(`//button[contains(text(), "Start attempt")] | //input[@type="submit" and contains(@value, "Start attempt")]`);
    //     if (fallbackButton.length > 0) {
    //         console.log("Found fallback 'Start attempt' button. Attempting to click...");
    //         await fallbackButton[0].click();
    //         await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });
    //         console.log("Quiz Attempt URL (via fallback):", page.url());
    //     } else {
    //         throw new Error("No 'Start attempt' button found. Check debug_page.html for details.");
    //     }
    // }

    async function getAIAnswer(prompt) {
        const apiKey = "AIzaSyB43n_ZMgajhuPxyKegvuT3UTPko5B4iLo";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            const aiResponse = data.candidates[0].content.parts[0].text.trim().toLowerCase();
            return ["a", "b", "c", "d"].includes(aiResponse) ? aiResponse : "d";
        } catch (error) {
            console.error("Error fetching AI answer:", error.message);
            return "d";
        }
    }

    const answerMap = { a: "0", b: "1", c: "2", d: "3" };
    const processedQuestions = new Set();
    let questionCount = 0;
    let hasNextPage = true;
    let pageCount = 0;
    const maxPages = 10;

    while (hasNextPage && questionCount < maxQuestions && pageCount < maxPages) {
        pageCount++;
        console.log(`Processing page ${pageCount}`);

        const questions = await page.$$eval(".que", (questionElements) => {
            return questionElements.map((qe) => {
                const questionText = qe.querySelector(".qtext")?.innerHTML.trim() || "Question not found";
                const options = Array.from(qe.querySelectorAll(".answer > div")).map((el, index) => {
                    const label = el.querySelector(".flex-fill")?.innerHTML.trim();
                    const input = el.querySelector('input[type="radio"]');
                    return {
                        letter: String.fromCharCode(97 + index),
                        label,
                        value: input?.getAttribute("value"),
                        name: input?.getAttribute("name"),
                    };
                });
                const questionId = options[0]?.name.split("_")[0];
                return { questionText, options, questionId };
            });
        });

        for (const { questionText, options, questionId } of questions) {
            if (processedQuestions.has(questionText)) {
                console.log(`Repeated question detected: "${questionText}". Stopping.`);
                hasNextPage = false;
                break;
            }
            processedQuestions.add(questionText);
            questionCount++;

            const optionsText = options.map((opt) => `${opt.letter}) ${opt.label}`).join(" ");
            const aiPrompt = `${questionText} ${optionsText} Please respond with only one letter: 'a', 'b', 'c', or 'd'.`;
            const answer = await getAIAnswer(aiPrompt);
            console.log(`AI selected answer for Q${questionCount}: ${answer}`);

            const answerValue = answerMap[answer] || answerMap["d"];
            const escapedQuestionId = questionId.replace(":", "\\:");
            const selector = `#${escapedQuestionId}_answer${answerValue}`;

            try {
                await page.waitForSelector(selector, { timeout: 15000 });
                await page.click(selector);
                console.log(`Selected answer: ${answer} (value: ${answerValue})`);
            } catch (error) {
                console.error(`Error selecting ${selector}: ${error.message}`);
                hasNextPage = false;
                break;
            }
        }

        const nextButton = await page.$("#mod_quiz-next-nav") || await page.$('input[name="next"][type="submit"]');
        if (nextButton && questionCount < maxQuestions) {
            try {
                await Promise.all([
                    page.click(nextButton.id ? "#mod_quiz-next-nav" : 'input[name="next"][type="submit"]'),
                    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(async () => {
                        await page.waitForFunction(
                            (prev) => {
                                const current = document.querySelector(".qtext")?.innerHTML.trim();
                                return current && current !== prev;
                            },
                            { timeout: 30000 },
                            questions[0]?.questionText || ""
                        );
                    }),
                ]);
                console.log("Moved to next page...");
            } catch (error) {
                console.error(`Navigation error: ${error.message}`);
                hasNextPage = false;
            }
        } else {
            console.log("No more pages or reached question limit.");
            hasNextPage = false;
        }
    }

    console.log("You can submit it now.");

    await new Promise(() => {});

})();