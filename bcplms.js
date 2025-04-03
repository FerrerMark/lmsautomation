const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
    var id = 235647;
    const question = 10; 

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        userDataDir: "C:\\Users\\ferre_roc1fyd\\AppData\\Local\\Google\\Chrome\\User Data\\PuppeteerProfile",
    });

    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 }); // You can adjust these values

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
    await page.goto(courseURL, { waitUntil: "networkidle2" });

    const sesskey = await page.evaluate(() => {
        const sesskeyElement = document.querySelector('input[name="sesskey"]');
        return sesskeyElement ? sesskeyElement.value : 'x7sgjicg4p';
    });

    const startAttemptURL = `https://bcpeducollege.elearningcommons.com/mod/quiz/startattempt.php?cmid=${id}&sesskey=${sesskey}&_qf__mod_quiz_form_preflight_check_form=1&submitbutton=Start%20attempt&x=Cancel`;

    try {
        await page.goto(startAttemptURL, { waitUntil: "networkidle2" });

        const submitButtonSelector = 'input[name="submitbutton"][value="Start attempt"]';
        await page.waitForSelector(submitButtonSelector, { visible: true, timeout: 10000 });

        await Promise.all([
            page.click(submitButtonSelector),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        const attemptURL = page.url();
        console.log("Quiz Attempt URL:", attemptURL);
    } catch (error) {
        console.error("Error navigating to start attempt or clicking submit:", error);
    }

    // Function to extract quiz content from the current page
    const extractQuizContent = async () => {
        return await page.evaluate(() => {
            const questionElements = document.querySelectorAll('.que');
            return Array.from(questionElements).map((qe) => {
                const questionNumberElement = qe.querySelector('.info h4 .rui-qno');
                const questionNumber = questionNumberElement ? questionNumberElement.innerHTML : "Unknown";

                const questionElement = qe.querySelector('.qtext');
                const question = questionElement ? questionElement.innerHTML : "Question not found";

                const answerElements = qe.querySelectorAll('.answer .d-flex');
                const choices = Array.from(answerElements).map((el, index) => {
                    const letter = String.fromCharCode(97 + index);
                    const text = el.querySelector('.flex-fill').innerHTML;
                    return `${letter}. ${text}`;
                }).join('\n');

                return `Question ${questionNumber}:\n${question}\n\n${choices}`;
            }).join('\n\n---\n\n');
        });
    };

    // Extract and save the first question
    let quizContent = await extractQuizContent();
    fs.writeFileSync("quiz_body.html", quizContent);

    // Loop to navigate through questions based on the 'question' variable
    const nextButtonSelector = 'input[name="next"][type="submit"]'; // Adjust selector if needed
    let questionCount = 1; // Start counting from the first question

    while (questionCount < question) {
        try {
            await page.waitForSelector(nextButtonSelector, { visible: true, timeout: 10000 });

            await Promise.all([
                page.click(nextButtonSelector),
                page.waitForNavigation({ waitUntil: "networkidle2" })
            ]);

            // Extract the current question and append to the file
            const newQuestionContent = await extractQuizContent();
            fs.appendFileSync("quiz_body.html", `\n\n---\n\n${newQuestionContent}`);
            console.log(`Question ${questionCount + 1} appended to quiz_body.html`);

            questionCount++; // Increment the question counter
        } catch (error) {
            console.error(`Error clicking Next button or extracting question ${questionCount + 1}:`, error);
            break;
        }
    }

    await new Promise(() => {});
})();