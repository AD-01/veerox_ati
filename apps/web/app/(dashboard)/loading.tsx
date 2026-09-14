'use client';

import React from 'react';
import { Skeleton, Card } from '@veerox/ui';

export default function DashboardLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton width="300px" height="36px" />
        <Skeleton width="500px" height="20px" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        <Card glass>
          <Skeleton height="100px" />
        </Card>
        <Card glass>
          <Skeleton height="100px" />
        </Card>
        <Card glass>
          <Skeleton height="100px" />
        </Card>
        <Card glass>
          <Skeleton height="100px" />
        </Card>
      </div>

      <Card bordered>
        <Skeleton height="200px" />
      </Card>
    </div>
  );
}
