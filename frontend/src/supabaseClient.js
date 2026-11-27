/**
 * Supabase Platform Client for KrishiSetu Frontend
 *
 * Provides:
 * - Supabase Auth (Sign in, Sign up, Google OAuth, Session Management)
 * - Supabase Realtime channel subscriptions for live orders, offers, and notifications
 * - Graceful fallback and operational transparency when external Supabase project is not yet configured.
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Standard headers for Supabase REST API requests
 */
function getHeaders(accessToken = null) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else if (SUPABASE_ANON_KEY) {
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  return headers;
}

/**
 * Supabase Authentication operations
 */
export const supabaseAuth = {
  /**
   * Register a new user with Supabase Auth
   */
  async signUp(email, password, metadata = {}) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase Auth is not configured. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
    }
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        email,
        password,
        data: metadata,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || data.msg || data.message || 'Sign up failed');
    }
    return data;
  },

  /**
   * Sign in using email and password
   */
  async signInWithPassword(email, password) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase Auth is not configured. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        email,
        password,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || data.msg || data.message || 'Invalid credentials');
    }
    return {
      user: data.user,
      access: data.access_token,
      refresh: data.refresh_token,
      expires_in: data.expires_in,
    };
  },

  /**
   * Initiate Google OAuth with Supabase
   */
  signInWithGoogle() {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase project credentials not configured.');
    }
    const redirectTo = encodeURIComponent(window.location.origin + '/account');
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  },

  /**
   * Sign out current session
   */
  async signOut(accessToken) {
    if (!isSupabaseConfigured || !accessToken) return;
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: getHeaders(accessToken),
      });
    } catch (e) {
      console.warn('Supabase logout notification failed:', e);
    }
  },

  /**
   * Fetch current authenticated user
   */
  async getUser(accessToken) {
    if (!isSupabaseConfigured || !accessToken) return null;
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: getHeaders(accessToken),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch {
      return null;
    }
    return null;
  },
};

/**
 * Lightweight Supabase Realtime WebSocket subscription helper
 */
export class RealtimeChannel {
  constructor(topic) {
    this.topic = topic;
    this.socket = null;
    this.handlers = [];
    this.ref = 1;
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.handlers.push(callback);
    }

    if (!isSupabaseConfigured || this.socket) return this;

    const wsUrl = `${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        // Join topic channel
        const joinMsg = {
          topic: this.topic,
          event: 'phx_join',
          payload: {},
          ref: String(this.ref++),
        };
        this.socket.send(JSON.stringify(joinMsg));
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.event === 'broadcast' || message.event === 'INSERT' || message.event === 'UPDATE') {
            this.handlers.forEach(h => h(message.payload));
          }
        } catch {}
      };

      this.socket.onerror = () => {
        // Silent recovery
      };
    } catch {
      // Offline fallback
    }

    return this;
  }

  unsubscribe() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.handlers = [];
  }
}

/**
 * Convenience helper to subscribe to database updates
 */
export function subscribeToRealtime(topic, onMessage) {
  const channel = new RealtimeChannel(topic);
  channel.subscribe(onMessage);
  return () => channel.unsubscribe();
}
