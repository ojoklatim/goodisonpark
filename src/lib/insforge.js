import { createClient } from '@insforge/sdk'

const INSFORGE_URL = import.meta.env.VITE_INSFORGE_URL
const INSFORGE_ANON_KEY = import.meta.env.VITE_INSFORGE_ANON_KEY

if (!INSFORGE_URL || !INSFORGE_ANON_KEY) {
  console.warn('InsForge credentials not set. Add VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY to your .env.local file.')
}

const sdkClient = createClient({
  baseUrl: INSFORGE_URL || 'https://placeholder.insforge.io',
  anonKey: INSFORGE_ANON_KEY || 'placeholder-anon-key'
})

const authListeners = new Set()

// Create a compatibility layer for the rest of the application that expects Supabase structure
export const insforge = {
  // Expose the database methods directly at the root for Supabase compatibility
  from: (table) => sdkClient.database.from(table),
  rpc: (fn, args) => sdkClient.database.rpc(fn, args),
  schema: (name) => sdkClient.database.schema(name),
  
  // Forward auth directly
  auth: {
    ...sdkClient.auth,
    // Add compatibility aliases
    getUser: () => sdkClient.auth.getCurrentUser(),
    getSession: () => sdkClient.auth.refreshSession(),
    signInWithPassword: (credentials) => sdkClient.auth.signInWithPassword(credentials),
    signUp: (credentials) => sdkClient.auth.signUp(credentials),
    sendResetPasswordEmail: (opts) => sdkClient.auth.sendResetPasswordEmail(opts),
    exchangeResetPasswordToken: (opts) => sdkClient.auth.exchangeResetPasswordToken(opts),
    resetPassword: (opts) => sdkClient.auth.resetPassword(opts),
    
    signOut: async () => {
      const res = await sdkClient.auth.signOut()
      authListeners.forEach(cb => cb('SIGNED_OUT', null))
      return res
    },

    onAuthStateChange: (callback) => {
      authListeners.add(callback)
      
      // Trigger initial callback
      const user = sdkClient.auth.tokenManager.getUser()
      const token = sdkClient.auth.tokenManager.getAccessToken()
      const session = token ? { user, access_token: token } : null
      callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', session)

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback)
            }
          }
        }
      }
    }
  },
  
  // Forward other namespaces
  storage: sdkClient.storage,
  functions: sdkClient.functions,
  realtime: sdkClient.realtime,
  emails: sdkClient.emails,
  channel: (name, opts) => {
    if (typeof sdkClient.channel === 'function') return sdkClient.channel(name, opts)
    if (typeof sdkClient.realtime?.channel === 'function') return sdkClient.realtime.channel(name, opts)
    return {
      on: () => ({
        subscribe: () => ({})
      })
    }
  },
  removeChannel: (sub) => {
    if (typeof sdkClient.removeChannel === 'function') return sdkClient.removeChannel(sub)
    if (typeof sdkClient.realtime?.removeChannel === 'function') return sdkClient.realtime.removeChannel(sub)
  }
}

export async function getCurrentUser() {
  return insforge.auth.getUser()
}

export async function getSession() {
  return insforge.auth.getSession()
}
