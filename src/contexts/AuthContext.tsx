import * as React from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../lib/firebase'

type Ctx = { user: User | null; loading: boolean }
const AuthContext = React.createContext<Ctx>({ user: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = React.useState<User | null>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => {
            setUser(u)
            setLoading(false)
        })
        return () => unsub()
    }, [])

    return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export const useAuth = () => React.useContext(AuthContext)
