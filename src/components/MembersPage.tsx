import React, { useEffect, useState, useMemo } from 'react';
import './MembersPage.css';

interface Member {
  _id?: string;
  address?: string;
  username?: string;
  realmCount?: number;
}

const MembersPage: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fetchingAddress, setFetchingAddress] = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/members-with-realm-counts');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch members data (${res.status})`);
      }
      const data = await res.json();
      setMembers(data);
    } catch (err: unknown) {
      console.error("Failed to fetch members:", err);
      let errorMessage = 'Failed to fetch members';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  // Sort members by realmCount descending, then by username ascending as a secondary sort
  const sortedMembers = useMemo(() => {
    if (!members) return [];
    return [...members].sort((a, b) => {
      // Sort by realmCount descending
      const realmCountDiff = (b.realmCount || 0) - (a.realmCount || 0);
      if (realmCountDiff !== 0) {
        return realmCountDiff;
      }
      // If realmCount is the same, sort by username ascending (case-insensitive)
      return (a.username || '').toLowerCase().localeCompare((b.username || '').toLowerCase());
    });
  }, [members]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!address && !username) {
      setError('Please enter an address or username');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, username }),
      });
      if (!res.ok) throw new Error('Failed to add member');
      setAddress('');
      setUsername('');
      fetchMembers();
    } catch (_err) {
      setError('Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAddressFromUsername = async () => {
    if (!username) {
      setError('Please enter a username to fetch the address.');
      return;
    }
    setFetchingAddress(true);
    setError(null);
    try {
      const response = await fetch(`/api/cartridge-address?username=${encodeURIComponent(username)}`);
      
      const result = await response.json();

      if (response.ok && result.address) {
        setAddress(result.address);
      } else {
        setError(result.error || 'Failed to fetch address. Please try again.');
        setAddress('');
        console.error("Fetch address error from backend:", result);
      }
    } catch (err: unknown) {
      console.error("Fetch address client-side/network error (calling own backend):", err);
      let errorMessage = 'Network error connecting to backend.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(`Failed to fetch address: ${errorMessage}`);
      setAddress('');
    } finally {
      setFetchingAddress(false);
    }
  };

  const handleRemove = async (member: Member) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: member.address, username: member.username }),
      });
      if (!res.ok) throw new Error('Failed to remove member');
      fetchMembers();
    } catch (_err) {
      setError('Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  // Use sortedMembers for filtering
  const filteredMembers = sortedMembers.filter(member => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (member.username?.toLowerCase().includes(searchLower) || false) ||
      (member.address?.toLowerCase().includes(searchLower) || false)
    );
  });

  return (
    <div className="members-root">
      <div className="members-header">
        <h1>WASD Guild Members</h1>
        <div className="members-search">
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="add-member-section">
        <h2>Add New Member</h2>
        <form onSubmit={handleAdd} className="add-member-form">
          <div className="form-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="form-input"
            />
          </div>
          <button
            type="button"
            onClick={handleFetchAddressFromUsername}
            className="add-button fetch-address-button"
            disabled={fetchingAddress || !username}
          >
            {fetchingAddress ? 'Fetching...' : 'Fetch Address'}
          </button>
          <div className="form-group">
            <input
              type="text"
              placeholder="Address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="form-input"
            />
          </div>
          <button 
            type="submit" 
            className="add-button" 
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Member'}
          </button>
        </form>
        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="members-list">
        <div className="members-list-header">
          <div className="header-cell username">Username</div>
          <div className="header-cell address">Address</div>
          <div className="header-cell realm-count">Season Passes</div>
          <div className="header-cell actions">Actions</div>
        </div>
        
        {loading ? (
          <div className="loading-message">Loading members...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="no-members">No members found</div>
        ) : (
          filteredMembers.map((member) => (
            <div key={member._id || member.address || member.username} className="member-row">
              <div className="member-cell username">
                {member.username || <span className="empty-value">-</span>}
              </div>
              <div className="member-cell address">
                {member.address || <span className="empty-value">-</span>}
              </div>
              <div className="member-cell realm-count">
                {member.realmCount !== undefined ? member.realmCount : 'N/A'}
              </div>
              <div className="member-cell actions">
                <button
                  onClick={() => handleRemove(member)}
                  className="remove-button"
                  disabled={loading}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MembersPage; 