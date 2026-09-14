'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Card, Alert, Spinner } from '@veerox/ui';
import { useAuth } from '../../lib/context/auth-context';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/dashboard';

  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    const result = await login(email.trim(), password);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || 'Authentication failed. Please check your credentials.');
      return;
    }

    router.push(returnUrl);
  };

  return (
    <Card glass bordered style={{ padding: '32px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Sign In
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Enter your credentials to access your trading workspace
          </p>
        </div>

        {error && (
          <Alert type="error" title="Sign In Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Input
          label="Email Address"
          type="email"
          placeholder="trader@veerox.ai"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={isLoading}
          required
          autoFocus
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={isLoading}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          style={{ width: '100%', marginTop: '8px' }}
        >
          Sign In to Workspace
        </Button>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'radial-gradient(ellipse at top, #111b2f 0%, var(--color-bg) 70%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient glow circles */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-brand-cyan), #0284c7)',
              boxShadow: 'var(--shadow-glow)',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff' }}>V</span>
          </div>

          <h1
            style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #ffffff 40%, var(--color-brand-cyan) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '8px',
            }}
          >
            Veerox ATI
          </h1>

          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Autonomous Trading Infrastructure Workspace
          </p>
        </div>

        {/* Suspense-wrapped form */}
        <Suspense
          fallback={
            <Card glass bordered style={{ padding: '32px', textAlign: 'center' }}>
              <Spinner size="lg" />
            </Card>
          }
        >
          <LoginForm />
        </Suspense>

        {/* Footer Note */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>
            Protected by Veerox Multi-Tenant Security & Session Isolation
          </p>
        </div>
      </div>
    </div>
  );
}
