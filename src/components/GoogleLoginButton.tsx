import * as React from 'react'
import { Button, CircularProgress } from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'
import type { User } from 'firebase/auth'
import { signInWithGoogle } from '../lib/firebase'

type Props = {
    onSuccess?: (user: User) => void
    onError?: (message: string) => void
    fullWidth?: boolean
}

export default function GoogleLoginButton({ onSuccess, onError, fullWidth = true }: Props) {
    const [loading, setLoading] = React.useState(false)

    const handleClick = async () => {
        setLoading(true)
        try {
            const user = await signInWithGoogle()
            // user === null artinya flow redirect sedang berjalan (mobile safari / popup blocked)
            if (user) onSuccess?.(user)
        } catch (err: any) {
            const code = err?.code as string | undefined
            const msg =
                code === 'auth/popup-closed-by-user'
                    ? 'Jendela login ditutup sebelum selesai.'
                    : code === 'auth/popup-blocked'
                        ? 'Popup diblokir browser. Coba izinkan popup atau login akan dialihkan otomatis.'
                        : err?.message ?? 'Gagal login.'
            onError?.(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            variant="contained"
            startIcon={loading ? undefined : <GoogleIcon />}
            onClick={handleClick}
            disabled={loading}
            fullWidth={fullWidth}
            sx={{ py: 1.2, borderRadius: 2 }}
        >
            {loading ? <CircularProgress size={22} sx={{ color: 'inherit' }} /> : 'Lanjutkan dengan Google'}
        </Button>
    )
}
