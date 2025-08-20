import * as React from 'react'
import { Container, Paper, Stack, Typography, Box } from '@mui/material'

type Props = {
    title: string
    subtitle?: string
    children: React.ReactNode
}

export default function AuthContainer({ title, subtitle, children }: Props) {
    return (
        <Container
            maxWidth="sm"
            sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', py: 6 }}
        >
            <Paper elevation={6} sx={{ p: 4, borderRadius: 3, width: '100%' }}>
                <Stack spacing={3} alignItems="center">
                    <Box textAlign="center">
                        <Typography variant="h5" fontWeight={700}>{title}</Typography>
                        {subtitle && (
                            <Typography variant="body2" color="text.secondary">
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    {children}
                </Stack>
            </Paper>
        </Container>
    )
}
