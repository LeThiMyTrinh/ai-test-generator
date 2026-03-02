import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)       // { email, role }
    const [token, setToken] = useState(null)
    const [loading, setLoading] = useState(true)

    // On mount: restore from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('auth_token')
        if (saved) {
            setToken(saved)
            // Verify token is still valid
            fetch('/api/auth/me', { headers: { Authorization: `Bearer ${saved}` } })
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(data => { setUser(data); setLoading(false) })
                .catch(() => { localStorage.removeItem('auth_token'); setToken(null); setLoading(false) })
        } else {
            setLoading(false)
        }
    }, [])

    const login = (newToken, userData) => {
        localStorage.setItem('auth_token', newToken)
        setToken(newToken)
        setUser(userData)
    }

    const logout = () => {
        localStorage.removeItem('auth_token')
        setToken(null)
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}
