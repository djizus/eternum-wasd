import React, { useEffect, useState } from 'react';
import './MembersPage.css';

interface Member {
  _id?: string;
  address?: string;
  username?: string;
}

const MembersPage: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/members');
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      setError('Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err) {
      setError('Failed to add member');
    } finally {
      setLoading(false);
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
    } catch (err) {
      setError('Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(member => {
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
              placeholder="Address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="form-input"
            />
          </div>
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