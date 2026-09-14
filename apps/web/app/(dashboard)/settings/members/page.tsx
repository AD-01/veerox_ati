'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Input } from '@veerox/ui';
import { useWorkspace } from '../../../../lib/context/workspace-context';
import { OrganizationMemberDto } from '@veerox/contracts';

export default function AdminMembersPage() {
  const { currentOrganization } = useWorkspace();
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/organizations/${currentOrganization.id}/members`);
      if (res.ok) {
        const data = await res.json() as OrganizationMemberDto[];
        setMembers(data);
      } else if (res.status === 401) {
        setError('Authentication error. Please log in again.');
      } else if (res.status === 403) {
        setError('You do not have permission to view members.');
      } else if (res.status === 404) {
        setError('Organization not found.');
      } else {
        setError(`Failed to fetch members: ${res.statusText}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRevoke = async (userId: string) => {
    if (!currentOrganization?.id) return;
    if (!confirm('Are you sure you want to revoke this member?')) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/organizations/${currentOrganization.id}/members/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchMembers();
      } else if (res.status === 401 || res.status === 403) {
        alert('You do not have permission to revoke members.');
      } else {
        alert(`Failed to revoke member: ${res.statusText}`);
      }
    } catch (err: unknown) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Organization Members
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: '4px' }}>
            Manage users, assign roles, and revoke access for {currentOrganization?.name || 'your organization'}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Input placeholder="Search members..." style={{ width: '250px' }} />
          <Button variant="default">Invite Member</Button>
        </div>
      </div>

      <Card glass bordered>
        <CardHeader>
          <CardTitle>Member Directory</CardTitle>
          <CardDescription>All active, suspended, and invited members</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-error)' }}>{error}</div>
          ) : loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading members...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Name</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Email</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Role</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No members found.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.userId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{member.user?.firstName} {member.user?.lastName}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>{member.user?.email || '-'}</td>
                      <td style={{ padding: '12px 8px' }}><Badge variant="default" size="sm">Member</Badge></td>
                      <td style={{ padding: '12px 8px' }}>
                        <Badge variant={member.status === 'ACTIVE' ? 'success' : 'outline'} size="sm">
                          {member.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          style={{ color: 'var(--color-error)' }}
                          onClick={() => handleRevoke(member.userId)}
                          isLoading={actionLoading === member.userId}
                        >
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
