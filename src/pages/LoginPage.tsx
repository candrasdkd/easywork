import * as React from 'react'
import { Alert } from '@mui/material'
import AuthContainer from '../components/AuthContainer'
import GoogleLoginButton from '../components/GoogleLoginButton'
import { finishGoogleRedirect } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useLocation, useNavigate } from 'react-router'

export default function Login() {
    const { user } = useAuth()
    const loc = useLocation()
    const navigate = useNavigate()
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (user) {
            const to = (loc.state as any)?.from?.pathname || '/'
            navigate(to, { replace: true })
        }
    }, [user, loc.state, navigate])

    React.useEffect(() => {
        finishGoogleRedirect()
            .then((cred) => {
                if (cred?.user) {
                    const to = (loc.state as any)?.from?.pathname || '/'
                    navigate(to, { replace: true })
                }
            })
            .catch((e: any) => setError(e?.message ?? 'Gagal menyelesaikan login.'))
    }, [loc.state, navigate])

    return (
        <AuthContainer title="Masuk">
            {error && <Alert severity="error">{error}</Alert>}
            <GoogleLoginButton
                onError={setError}
                onSuccess={() => {
                    const to = (loc.state as any)?.from?.pathname || '/'
                    navigate(to, { replace: true })
                }}
            />
        </AuthContainer>
    )
}
