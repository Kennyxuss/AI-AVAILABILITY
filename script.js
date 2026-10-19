
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

window.onload = () => {
    const chatHistory = localStorage.getItem("chatHistory");
    if (chatHistory) chatBox.innerHTML = chatHistory;
    chatBox.scrollTop = chatBox.scrollHeight;

}

function addMessage(message, className) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add("message", className);
    msgDiv.textContent = message;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.classList.add("message", "bot-message");
    typingDiv.textContent = "AI is Typing...";
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return typingDiv;
}

async function getBotReplay(userMessage) {
    const url = '/api/chat';

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {"Content-type": "application/json"},
            body: JSON.stringify({ message: userMessage })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("API Error:", data);
            return data?.error || "Error fetching response";
        }

        return data?.text || "Sorry, I couldn't get that";
    } catch (error) {
        console.error("Fetch error:", error);
        return "Sorry, something went wrong.";
    }
}

sendBtn.onclick = async () => {
    const userMessage = userInput.value.trim();
    if (userMessage === "") return;
    addMessage(userMessage, "user-message");
    userInput.value = ""

    const typingDiv = showTyping();

    const botReplay = await getBotReplay(userMessage);
    typingDiv.remove();

    addMessage(botReplay, "bot-message");

    localStorage.setItem("chatHistory", chatBox.innerHTML);
}


userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendBtn.click();
})