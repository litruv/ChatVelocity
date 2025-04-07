class ChatApp {
    constructor(chatContainerId, maxMessages = 100) {
        this.chatContainer = document.getElementById(chatContainerId);
        this.MAX_MESSAGES = maxMessages;
        this.messageMap = new Map();
        this.currentColumnIndex = 0;
        this.columns = parseInt(ChatApp.getQueryParam('columns')) || 1;
        this.MIN_WORDS = parseInt(ChatApp.getQueryParam('minWords')) || 1;
        this.isHovering = new Array(this.columns).fill(false);
        this.messageCounter = 0;

        this.setupEventListeners();
    }

    static getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    async initialize(username) {
        if (!username) {
            console.error("No 'user' query parameter provided.");
            alert("Please provide a Twitch username in the URL, e.g., ?user=zackrawrr");
            throw new Error("Missing 'user' query parameter.");
        }

        try {
            const { userId, twitchEmotes } = await this.fetchTwitchUserData(username);
            const sevenTvEmotes = await this.fetch7TVEmotes(userId);

            await this.setupColumns();
            await this.setupTmiClient(username, twitchEmotes, sevenTvEmotes);
        } catch (error) {
            console.error(error);
            alert('An error occurred. Please try again later.');
        }
    }

    async fetchTwitchUserData(username) {
        const response = await fetch(`https://twitchapi.ruv.wtf/twitch/userdata?username=${username}`);
        if (!response.ok) throw new Error(`Failed to fetch Twitch data: ${response.statusText}`);
        return response.json();
    }

    async fetch7TVEmotes(userId) {
        try {
            const response = await fetch(`https://7tv.io/v3/users/twitch/${userId}`);
            if (!response.ok) {
                console.warn(`7TV emotes fetch failed with status ${response.status}. Continuing without 7TV emotes.`);
                return {};
            }

            const emotesData = await response.json();
            if (!emotesData?.emote_set?.emotes) {
                console.warn("7TV emotes data is null or does not contain emotes. Continuing without 7TV emotes.");
                return {};
            }

            return emotesData.emote_set.emotes.reduce((acc, emote) => {
                acc[emote.name] = `https://cdn.7tv.app/emote/${emote.id}/1x.webp`;
                return acc;
            }, {});
        } catch (error) {
            console.error("Error in fetch7TVEmotes:", error);
            return {};
        }
    }

    async setupTmiClient(username, twitchEmotes, sevenTvEmotes) {
        const client = new tmi.Client({ channels: [username] });

        await client.connect();

        client.on('message', (channel, tags, message, self) => {
            if (self || message.startsWith('!') || tags.badges?.broadcaster || tags.badges?.moderator) return;

            const wordCount = message.split(/\s+/).filter(word => word.length > 0).length;
            if (wordCount < this.MIN_WORDS) return;

            const parsedMessage = this.parseEmotes(message, tags.emotes || {}, sevenTvEmotes);
            const userData = { name: tags.username, color: tags.color || '#ffffff' };

            this.addMessageToChat(userData.name, userData.color, parsedMessage);
        });
    }

    async setupColumns() {
        this.chatContainer.innerHTML = '';
        for (let i = 0; i < this.columns; i++) {
            const column = document.createElement('div');
            column.id = `column-${i}`;
            column.className = 'column';
            this.chatContainer.appendChild(column);
        }

        this.setupColumnHover();
    }

    setupEventListeners() {
        document.getElementById('apply-settings').addEventListener('click', () => {
            this.MIN_WORDS = parseInt(document.getElementById('minWords').value, 10);
            this.columns = parseInt(document.getElementById('columns').value, 10);
            this.updateColumns();
        });
    }

    updateColumns() {
        const currentColumns = this.chatContainer.querySelectorAll('.column');
        const currentColumnCount = currentColumns.length;

        if (this.columns > currentColumnCount) {
            for (let i = currentColumnCount; i < this.columns; i++) {
                this.createColumn(i);
            }
        } else if (this.columns < currentColumnCount) {
            this.rebuildColumns(currentColumns);
        }

        this.setupColumnHover();
    }

    createColumn(index) {
        const column = document.createElement('div');
        column.id = `column-${index}`;
        column.className = 'column';
        this.chatContainer.appendChild(column);
    }

    rebuildColumns(currentColumns) {
        const allMessages = [];

        currentColumns.forEach(column => {
            Array.from(column.children).forEach(message => allMessages.push(message));
            column.remove();
        });

        for (let i = 0; i < this.columns; i++) {
            this.createColumn(i);
        }

        allMessages.forEach((message, index) => {
            const targetColumn = this.chatContainer.querySelector(`#column-${index % this.columns}`);
            targetColumn.appendChild(message);
        });
    }

    setupColumnHover() {
        for (let i = 0; i < this.columns; i++) {
            const column = document.getElementById(`column-${i}`);
            column.addEventListener('mouseenter', () => this.isHovering[i] = true);
            column.addEventListener('mouseleave', () => this.isHovering[i] = false);
        }
    }

    scrollToBottom(columnIndex) {
        if (!this.isHovering[columnIndex]) {
            const chatColumn = document.getElementById(`column-${columnIndex}`);
            chatColumn.scrollTo({ top: chatColumn.scrollHeight, behavior: 'smooth' });
        }
    }

    addMessageToChat(displayName, color, message) {
        const hash = ChatApp.hashMessage(message);
        let messageElement;
        const userData = { name: displayName, color };

        let columnIndex;

        if (this.messageMap.has(hash)) {
            const messageData = this.messageMap.get(hash);
            columnIndex = messageData.element.getAttribute('data-column-index');
            messageData.users.push(userData);
            messageElement = messageData.element;
            this.updateMessageContent(messageElement, messageData);
        } else {
            columnIndex = this.messageCounter % this.columns;
            this.messageCounter++;

            messageElement = document.createElement('div');
            messageElement.className = 'chat-message';
            messageElement.setAttribute('data-hash', hash);
            messageElement.setAttribute('data-column-index', columnIndex);

            const messageData = { message, users: [userData], element: messageElement };
            this.messageMap.set(hash, messageData);
            this.updateMessageContent(messageElement, messageData);
        }

        const column = document.getElementById(`column-${columnIndex}`);
        column.appendChild(messageElement);

        while (column.children.length > this.MAX_MESSAGES) {
            const oldestMessage = column.firstChild;
            const oldHash = oldestMessage.getAttribute('data-hash');
            this.messageMap.delete(oldHash);
            column.removeChild(oldestMessage);
        }

        this.scrollToBottom(columnIndex);
    }

    static hashMessage(str) {
      str = str.toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/(<img\s*src="[^"]+"[^>]*>)/g, (match) => {
              return '<img />';
          })
          .replace(/(<[^>]+>)/g, (match) => match.trim())
          .split(' ')
          .filter((word, index, words) => word !== words[index - 1])
          .join('')
          .replace(/[^a-z0-9\s<>/]/g, '')
          .replace(/\s+/g, ' ')
          .replace(/(.)\1+/g, '$1');
  
      let hash = 2166136261;
      for (let i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
  
      return (hash >>> 0).toString(16).padStart(8, '0').slice(-8);
    }

    formatMessage(message) {
        return message.replace(/(@\w+)/g, '<span class="mention">$1</span>');
    }

    parseEmotes(message, twitchEmotes = {}, sevenTvEmotes = {}) {
        if (!twitchEmotes && !sevenTvEmotes) return message;
    
        let messageArray = [...message];
    
        if (twitchEmotes && Object.keys(twitchEmotes).length > 0) {
            const positionMap = new Map();
    
            Object.entries(twitchEmotes).forEach(([emoteId, positions]) => {
                if (!Array.isArray(positions)) return;
    
                positions.forEach(position => {
                    if (typeof position !== 'string') return;
    
                    const [start, end] = position.split('-').map(Number);
                    if (isNaN(start) || isNaN(end)) return;
    
                    const emoteText = message.slice(start, end + 1);
                    const emoteImg = `<img src="https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/1.0" class="emote twitch-emote" alt="${emoteText}">`;
    
                    for (let i = start; i <= end; i++) {
                        positionMap.set(i, i === start ? emoteImg : '');
                    }
                });
            });
    
            messageArray = messageArray.map((char, index) =>
                positionMap.has(index) ? positionMap.get(index) : char
            );
        }
    
        let parsedMessage = messageArray.join('');
    
        if (sevenTvEmotes && Object.keys(sevenTvEmotes).length > 0) {
            Object.entries(sevenTvEmotes).forEach(([emoteName, emoteUrl]) => {
                // Escape special characters in the emote name for use in regex
                const escapedEmoteName = emoteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                try {
                    const emoteRegEx = new RegExp(`\\b${escapedEmoteName}\\b`, 'g');
                    parsedMessage = parsedMessage.replace(
                        emoteRegEx,
                        `<img src="${emoteUrl}" class="emote seventv-emote" alt="${emoteName}">`
                    );
                } catch (error) {
                    console.warn(`Failed to create regex for emote: ${emoteName}`, error);
                }
            });
        }
    
        return parsedMessage;
    }
    

    updateMessageContent(messageElement, messageData) {
      const { message, users } = messageData;
      const uniqueUsers = new Set(users);
  
      messageElement.innerHTML = '';
  
      if (uniqueUsers.size === 1) {
          const [firstUser] = users;
          const usernameSpan = document.createElement('span');
          usernameSpan.className = 'username';
          usernameSpan.style.color = firstUser.color;
          usernameSpan.textContent = firstUser.name;
          messageElement.appendChild(usernameSpan);
          messageElement.appendChild(document.createTextNode(': '));
      }
  
      messageElement.insertAdjacentHTML('beforeend', this.formatMessage(message));
  
      if (users.length > 1) {
          const counter = document.createElement('span');
          counter.className = 'duplicate-count';
  
          const intensity = Math.min(1, Math.log(users.length) / 4);
          counter.style.backgroundColor = `rgb(${255 * intensity}, ${255 - 255 * intensity}, 50)`;
          counter.textContent = `×${users.length}`;
          messageElement.appendChild(counter);
      }
    }
}

(async () => {
    const username = ChatApp.getQueryParam('user');
    const app = new ChatApp('chat-container');
    await app.initialize(username);
})();
