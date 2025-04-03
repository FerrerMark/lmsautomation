document.getElementById('scraper-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const id = document.getElementById('id').value;
    const questionCount = document.getElementById('questionCount').value;
    const messageElement = document.getElementById('message');
    const questionsElement = document.getElementById('questions');

    if (!password || !id || !questionCount) {
        messageElement.textContent = 'Please fill in all required fields (password, ID, and question count).';
        return;
    }

    messageElement.textContent = 'Scraping in progress...';

    try {
        const response = await fetch('/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                username,
                password,
                id,
                questionCount,
            }),
        });

        const result = await response.json();
        messageElement.textContent = result.message;

        // Fetch and display the contents of quiz_body.html
        const quizResponse = await fetch('/get-quiz');
        if (quizResponse.ok) {
            const quizContent = await quizResponse.text();
            questionsElement.innerHTML = quizContent; // Display the content
        } else {
            questionsElement.textContent = 'Failed to load quiz content.';
        }
    } catch (error) {
        messageElement.textContent = 'Error: Could not connect to the server.';
        console.error('Error:', error);
    }
});