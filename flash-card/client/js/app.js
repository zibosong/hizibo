document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    const API_BASE_URL = 'http://localhost:3000/api';

    // --- State Management ---
    let state = {
        cardSets: [],
        currentSet: null,
        flashcards: [],
        allTags: [],
        currentView: 'sets' // 'sets' or 'cards'
    };

    // --- API Helper ---
    async function apiRequest(endpoint, method = 'GET', body = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.msg || `API request failed: ${response.statusText}`);
            }
            if (response.status === 204) return null;
            return response.json();
        } catch (error) {
            console.error(`Error with ${method} ${endpoint}:`, error);
            alert(`An error occurred: ${error.message}`);
            return null;
        }
    }

    // --- Render Functions ---
    function render() {
        appContainer.innerHTML = ''; // Clear previous content
        switch (state.currentView) {
            case 'sets':
                renderCardSetsListView();
                break;
            case 'cards':
                renderFlashcardsView();
                break;
        }
    }

    async function renderCardSetsListView() {
        const [sets, tags] = await Promise.all([apiRequest('/card-sets'), apiRequest('/tags')]);
        state.cardSets = sets || [];
        state.allTags = tags || [];

        const setsHtml = state.cardSets.map(set => `
            <div class="card-set" data-id="${set.id}">
                <h2>${set.name}</h2>
                <p>${set.description || 'No description'}</p>
                <button class="view-set-btn">View Set</button>
            </div>
        `).join('');

        appContainer.innerHTML = `
            <div class="form-container">
                <h3>Create a New Card Set</h3>
                <form id="create-set-form">
                    <input type="text" id="new-set-name" placeholder="Card Set Name" required>
                    <textarea id="new-set-description" placeholder="Description"></textarea>
                    <button type="submit">Create Set</button>
                </form>
            </div>
            <div class="card-sets-container">
                ${state.cardSets.length > 0 ? setsHtml : '<p>No card sets found.</p>'}
            </div>
        `;
    }

    function renderCardContent(card) {
        const renderFace = (content, type) => {
            if (type === 'image_url') {
                return `<img src="${content}" alt="Flashcard Image">`;
            }
            return content;
        };

        const tagsHtml = card.tags.map(tag => `
            <span class="tag">${tag.name} <span class="tag-remove" data-tag-id="${tag.id}">&times;</span></span>
        `).join('');

        const difficultyHtml = Array.from({length: 5}, (_, i) => `
            <div class="difficulty-dot ${card.difficulty_level > i ? 'active' : ''}" data-level="${i + 1}"></div>
        `).join('');

        return `
            <div class="flashcard-face flashcard-face--front">
                <div class="flashcard-content">${renderFace(card.front_content, card.front_content_type)}</div>
            </div>
            <div class="flashcard-face flashcard-face--back">
                <div class="flashcard-content">${renderFace(card.back_content, card.back_content_type)}</div>
                <div class="card-meta">
                    <div class="difficulty-level" data-card-id="${card.id}">
                        <span>Difficulty:</span> ${difficultyHtml}
                    </div>
                    <div class="tags-container">${tagsHtml}</div>
                    <form class="add-tag-form" data-card-id="${card.id}">
                        <input type="text" list="tags-datalist" placeholder="Add tag...">
                        <button type="submit">Add</button>
                    </form>
                </div>
            </div>
        `;
    }

    async function renderFlashcardsView() {
        const [set, flashcards] = await Promise.all([
            apiRequest(`/card-sets/${state.currentSet.id}`),
            apiRequest(`/flashcards?card_set_id=${state.currentSet.id}`)
        ]);
        state.currentSet = set;
        state.flashcards = flashcards || [];

        const cardsHtml = state.flashcards.map(card => `
            <div class="flashcard" data-id="${card.id}">
                ${renderCardContent(card)}
            </div>
        `).join('');

        const tagsDatalist = state.allTags.map(tag => `<option value="${tag.name}"></option>`).join('');

        appContainer.innerHTML = `
            <div class="flashcards-view">
                <button class="back-btn">&larr; Back to Sets</button>
                <h2>${state.currentSet.name}</h2>
                <div class="form-container">
                    <h3>Add a New Flashcard</h3>
                    <form id="create-card-form">
                        <label>Front</label>
                        <select class="content-type-selector" data-for="front">
                            <option value="text">Text</option>
                            <option value="image_url">Image URL</option>
                        </select>
                        <textarea id="new-card-front-text" placeholder="Front content" required></textarea>
                        <input type="text" id="new-card-front-image" placeholder="http://..." class="hidden">

                        <label>Back</label>
                        <select class="content-type-selector" data-for="back">
                            <option value="text">Text</option>
                            <option value="image_url">Image URL</option>
                        </select>
                        <textarea id="new-card-back-text" placeholder="Back content" required></textarea>
                        <input type="text" id="new-card-back-image" placeholder="http://..." class="hidden">

                        <button type="submit">Add Card</button>
                    </form>
                </div>
                <datalist id="tags-datalist">${tagsDatalist}</datalist>
                <div class="flashcard-container">
                    ${state.flashcards.length > 0 ? cardsHtml : '<p>This set is empty.</p>'}
                </div>
            </div>
        `;
    }

    // --- Event Handlers ---
    appContainer.addEventListener('click', async (e) => {
        // Card flip logic
        if (e.target.closest('.flashcard') && !e.target.closest('.card-meta')) {
            e.target.closest('.flashcard').classList.toggle('is-flipped');
            return;
        }
        // View Set
        if (e.target.classList.contains('view-set-btn')) {
            state.currentSet = { id: e.target.closest('.card-set').dataset.id };
            state.currentView = 'cards';
            render();
            return;
        }
        // Back to Sets
        if (e.target.classList.contains('back-btn')) {
            state.currentView = 'sets';
            state.currentSet = null;
            render();
            return;
        }
        // Update difficulty
        if (e.target.classList.contains('difficulty-dot')) {
            const cardId = e.target.parentElement.dataset.cardId;
            const level = e.target.dataset.level;
            const updatedCard = await apiRequest(`/flashcards/${cardId}`, 'PUT', { difficulty_level: level });
            if (updatedCard) {
                const cardIndex = state.flashcards.findIndex(c => c.id == cardId);
                state.flashcards[cardIndex] = { ...state.flashcards[cardIndex], ...updatedCard };
                const cardElement = e.target.closest('.flashcard');
                cardElement.innerHTML = renderCardContent(state.flashcards[cardIndex]);
            }
        }
        // Remove tag
        if (e.target.classList.contains('tag-remove')) {
            const cardId = e.target.closest('.flashcard').dataset.id;
            const tagId = e.target.dataset.tagId;
            await apiRequest(`/flashcards/${cardId}/tags/${tagId}`, 'DELETE');
            
            const cardIndex = state.flashcards.findIndex(c => c.id == cardId);
            state.flashcards[cardIndex].tags = state.flashcards[cardIndex].tags.filter(t => t.id != tagId);
            const cardElement = e.target.closest('.flashcard');
            cardElement.innerHTML = renderCardContent(state.flashcards[cardIndex]);
        }
    });

    appContainer.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (e.target.id === 'create-set-form') {
            const name = document.getElementById('new-set-name').value;
            const description = document.getElementById('new-set-description').value;
            const newSet = await apiRequest('/card-sets', 'POST', { name, description });
            if (newSet) {
                state.cardSets.unshift(newSet); // Add to start of array
                render(); // Re-render the view
            }
        }
        if (e.target.id === 'create-card-form') {
            const getFieldData = (side) => ({
                type: document.querySelector(`.content-type-selector[data-for="${side}"]`).value,
                text: document.getElementById(`new-card-${side}-text`).value,
                image: document.getElementById(`new-card-${side}-image`).value
            });

            const front = getFieldData('front');
            const back = getFieldData('back');

            const newCard = await apiRequest('/flashcards', 'POST', {
                card_set_id: state.currentSet.id,
                front_content_type: front.type,
                front_content: front.type === 'text' ? front.text : front.image,
                back_content_type: back.type,
                back_content: back.type === 'text' ? back.text : back.image,
            });

            if (newCard) {
                newCard.tags = []; // new cards have no tags initially
                state.flashcards.push(newCard);
                render();
            }
        }
        // Add tag
        if (e.target.classList.contains('add-tag-form')) {
            const cardId = e.target.dataset.cardId;
            const tagName = e.target.querySelector('input').value.trim();
            if (!tagName) return;

            // Find existing tag or create a new one
            let tag = state.allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
            if (!tag) {
                tag = await apiRequest('/tags', 'POST', { name: tagName });
                if (tag) state.allTags.push(tag);
            }

            if (tag) {
                await apiRequest(`/flashcards/${cardId}/tags`, 'POST', { tag_id: tag.id });
                
                const cardIndex = state.flashcards.findIndex(c => c.id == cardId);
                // Avoid adding duplicate tag to local state if server handled conflict
                if (!state.flashcards[cardIndex].tags.some(t => t.id === tag.id)) {
                    state.flashcards[cardIndex].tags.push(tag);
                }

                const cardElement = document.querySelector(`.flashcard[data-id='${cardId}']`);
                cardElement.innerHTML = renderCardContent(state.flashcards[cardIndex]);
            }
        }
    });

    // Handle content type switching in the form
    appContainer.addEventListener('change', e => {
        if (e.target.classList.contains('content-type-selector')) {
            const side = e.target.dataset.for;
            const isText = e.target.value === 'text';
            document.getElementById(`new-card-${side}-text`).classList.toggle('hidden', !isText);
            document.getElementById(`new-card-${side}-image`).classList.toggle('hidden', isText);
        }
    });

    // --- Initial Load ---
    render();
}); 