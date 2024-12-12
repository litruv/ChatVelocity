// Constants
const CONFIG = {
    CACHE_TTL: 86400,
    TWITCH_API: {
      TOKEN_URL: 'https://id.twitch.tv/oauth2/token',
      USERS_URL: 'https://api.twitch.tv/helix/users',
      EMOTES_URL: 'https://api.twitch.tv/helix/chat/emotes'
    }
  };
  
  // Cache management
  class TokenCache {
    static token = null;
    static timestamp = 0;
  
    static isExpired() {
      return !this.token || (Date.now() - this.timestamp) / 1000 > CONFIG.CACHE_TTL;
    }
  
    static update(token) {
      this.token = token;
      this.timestamp = Date.now();
    }
  
    static get() {
      return this.token;
    }
  }
  
  // API helpers
  class TwitchAPI {
    constructor(env) {
      this.env = env;
    }
  
    async refreshToken() {
      if (!TokenCache.isExpired()) {
        return TokenCache.get();
      }
  
      const response = await fetch(CONFIG.TWITCH_API.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.env.TWITCH_CLIENT_ID,
          client_secret: this.env.TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials'
        })
      });
  
      const data = await this.handleResponse(response, 'Token refresh failed');
      TokenCache.update(data.access_token);
      return data.access_token;
    }
  
    async getUser(username) {
      const token = await this.refreshToken();
      const response = await fetch(
        `${CONFIG.TWITCH_API.USERS_URL}?login=${encodeURIComponent(username)}`,
        {
          headers: this.getHeaders(token)
        }
      );
  
      const data = await this.handleResponse(response, 'User fetch failed');
      const user = data.data[0];
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }
  
      return user;
    }
  
    async getEmotes(userId) {
      const token = await this.refreshToken();
      const response = await fetch(
        `${CONFIG.TWITCH_API.EMOTES_URL}?broadcaster_id=${userId}`,
        {
          headers: this.getHeaders(token)
        }
      );
  
      const data = await this.handleResponse(response, 'Emotes fetch failed');
      return this.formatEmotes(data.data);
    }
  
    getHeaders(token) {
      return {
        'Client-ID': this.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      };
    }
  
    async handleResponse(response, errorPrefix) {
      if (!response.ok) {
        const text = await response.text();
        throw new HttpError(`${errorPrefix}: ${text}`, response.status);
      }
      return response.json();
    }
  
    formatEmotes(emotes) {
      return emotes.reduce((acc, emote) => {
        acc[emote.name] = emote.images.url_1x;
        return acc;
      }, {});
    }
  }
  
  // Error handling
  class HttpError extends Error {
    constructor(message, status = 500) {
      super(message);
      this.status = status;
    }
  }
  
  // Response helpers
  class ResponseHandler {
    static json(data, status = 200) {
      return new Response(
        JSON.stringify(data),
        {
          status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*'
          }
        }
      );
    }
  
    static error(error) {
      const status = error instanceof HttpError ? error.status : 500;
      return this.json({ error: error.message }, status);
    }
  }
  
  // Request handler
  class RequestHandler {
    static validateRequest(request) {
      const url = new URL(request.url);
      const username = url.searchParams.get('username');
  
      if (url.pathname !== '/twitch/userdata' || !username) {
        throw new HttpError('Invalid endpoint or missing username', 400);
      }
  
      return username;
    }
  }
  
  // Main worker
  export default {
    async fetch(request, env) {
      try {
        const username = RequestHandler.validateRequest(request);
        const api = new TwitchAPI(env);
        
        const user = await api.getUser(username);
        const twitchEmotes = await api.getEmotes(user.id);
        
        return ResponseHandler.json({
          userId: user.id,
          twitchEmotes
        });
      } catch (error) {
        console.error('Worker error:', error);
        return ResponseHandler.error(error);
      }
    }
  };
  