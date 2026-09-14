'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Alert } from '@veerox/ui';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <Card glass bordered style={{ maxWidth: '500px', width: '100%' }}>
        <CardHeader>
          <CardTitle style={{ color: 'var(--color-danger)' }}>Workspace Error</CardTitle>
          <CardDescription>An unexpected error occurred while loading this view.</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Alert type="error" title="Error Details">
            {error?.message || 'Unknown application error occurred.'}
          </Alert>

          <Button variant="primary" onClick={() => reset()} style={{ alignSelf: 'flex-start' }}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
