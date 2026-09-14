'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@veerox/ui';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg)',
        padding: '24px',
      }}
    >
      <Card glass bordered style={{ maxWidth: '460px', width: '100%', textAlign: 'center' }}>
        <CardHeader>
          <div
            style={{
              fontSize: '48px',
              fontWeight: 800,
              color: 'var(--color-brand-cyan)',
              lineHeight: 1,
              marginBottom: '8px',
            }}
          >
            404
          </div>
          <CardTitle>Page Not Found</CardTitle>
          <CardDescription>
            The requested workspace resource or page could not be located.
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
          <Link href="/dashboard">
            <Button variant="primary">Return to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
