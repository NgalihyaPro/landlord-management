'use client';
import { AuthProvider } from '@/hooks/useAuth';
import { LanguageProvider } from '@/context/LanguageContext';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </LanguageProvider>
  );
}
