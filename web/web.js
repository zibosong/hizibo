const messageElement = document.getElementById('message');

function clickMe() {
    fetch('http://app.local.lab:3000/')
        .then(response => response.json())
        .then(data => {
            messageElement.textContent = data;
        })
        .catch(error => {
            console.error('Error:', error);
            messageElement.textContent = 'Error fetching data';
        });
}

function clearMe() {
    messageElement.textContent = 'Welcome to Hi Zibo!';
}