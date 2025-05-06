import { useState, useMemo, useEffect } from 'react';
import type { Realm } from '../types/resources';
import { ResourcesIds } from '../types/resources';
import { loadRealms } from '../services/realms';
import * as XLSX from 'xlsx';
import './Dashboard.css';

// Get all troop types from ResourcesIds enum (those with 'Knight', 'Crossbowman', 'Paladin', etc.)
const TROOP_TYPES = Object.entries(ResourcesIds)
  .filter(([key, value]) => typeof value === 'number' && (
    key.startsWith('Knight') || key.startsWith('Crossbowman') || key.startsWith('Paladin')
  ))
  .map(([key, value]) => ({ key, value: value as number }));

// Helper: list of all troop/unit resource IDs
const TROOP_IDS = TROOP_TYPES.map(t => t.value);
// List of resource IDs to exclude from the filter
const EXCLUDED_RESOURCES = [
  ResourcesIds.Labor,
  ResourcesIds.AncientFragment,
  ResourcesIds.Donkey,
  ResourcesIds.Lords,
  ResourcesIds.Wheat,
  ResourcesIds.Fish,
];

// Resource rarity mapping (example)
const RESOURCE_RARITY: Record<number, 'common' | 'rare' | 'epic' | 'legendary'> = {
  [ResourcesIds.Wood]: 'common',
  [ResourcesIds.Stone]: 'common',
  [ResourcesIds.Coal]: 'common',
  [ResourcesIds.Copper]: 'common',
  [ResourcesIds.Obsidian]: 'rare',
  [ResourcesIds.Silver]: 'rare',
  [ResourcesIds.Ironwood]: 'rare',
  [ResourcesIds.ColdIron]: 'rare',
  [ResourcesIds.Gold]: 'epic',
  [ResourcesIds.Hartwood]: 'epic',
  [ResourcesIds.Diamonds]: 'epic',
  [ResourcesIds.Sapphire]: 'epic',
  [ResourcesIds.Ruby]: 'epic',
  [ResourcesIds.DeepCrystal]: 'legendary',
  [ResourcesIds.Ignium]: 'legendary',
  [ResourcesIds.EtherealSilica]: 'legendary',
  [ResourcesIds.TrueIce]: 'legendary',
  [ResourcesIds.TwilightQuartz]: 'legendary',
  [ResourcesIds.AlchemicalSilver]: 'legendary',
  [ResourcesIds.Adamantine]: 'legendary',
  [ResourcesIds.Mithral]: 'legendary',
  [ResourcesIds.Dragonhide]: 'legendary',
  [ResourcesIds.Knight]: 'rare',
  [ResourcesIds.KnightT2]: 'epic',
  [ResourcesIds.KnightT3]: 'legendary',
  [ResourcesIds.Crossbowman]: 'rare',
  [ResourcesIds.CrossbowmanT2]: 'epic',
  [ResourcesIds.CrossbowmanT3]: 'legendary',
  [ResourcesIds.Paladin]: 'rare',
  [ResourcesIds.PaladinT2]: 'epic',
  [ResourcesIds.PaladinT3]: 'legendary',
};

// Troop tier mapping for color coding
const troopTierMap: Record<string, 'T1' | 'T2' | 'T3'> = {
  Knight: 'T1', Crossbowman: 'T1', Paladin: 'T1',
  KnightT2: 'T2', CrossbowmanT2: 'T2', PaladinT2: 'T2',
  KnightT3: 'T3', CrossbowmanT3: 'T3', PaladinT3: 'T3',
};

interface Member {
  _id?: string; // Assuming _id might exist from DB
  address?: string;
  username?: string; // Ensure username is part of the Member interface
}

const Dashboard = () => {
  const [realms, setRealms] = useState<Realm[]>([]);
  // Store full member details instead of just addresses
  const [guildMembersDetails, setGuildMembersDetails] = useState<Member[]>([]); 
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true); // Separate loading state for members
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResource, setSelectedResource] = useState<ResourcesIds | null>(null);
  const [selectedTroop, setSelectedTroop] = useState<ResourcesIds | null>(null);
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('id');
  const [isProcessingFilters, setIsProcessingFilters] = useState(false);
  const [isRefreshingOwners, setIsRefreshingOwners] = useState(false);
  const [filterByGuildMembers, setFilterByGuildMembers] = useState<boolean>(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setLoadingMembers(true);
      try {
        const [loadedRealms, memberResponse] = await Promise.all([
          loadRealms(),
          fetch('/api/members')
        ]);
        
        setRealms(loadedRealms);

        if (memberResponse.ok) {
          const membersData: Member[] = await memberResponse.json();
          setGuildMembersDetails(membersData); // Store full member details
          console.log(`Loaded ${membersData.length} guild member details.`);
        } else {
          console.error('Failed to fetch guild members:', memberResponse.statusText);
          setGuildMembersDetails([]); // Set empty on error
        }

      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
        setLoadingMembers(false);
      }
    };
    fetchInitialData();
  }, []);

  // Create a memoized map from lowercase address to username
  const memberAddressToUsernameMap = useMemo(() => {
    const map = new Map<string, string>();
    guildMembersDetails.forEach(member => {
      if (member.address && member.username) {
        map.set(member.address.toLowerCase(), member.username);
      }
    });
    return map;
  }, [guildMembersDetails]);

  // Use this map for the guild member filter check as well (more efficient)
  const guildMemberAddresses = useMemo(() => {
    return new Set(memberAddressToUsernameMap.keys());
  }, [memberAddressToUsernameMap]);

  // Modify uniqueOwners to create a list of { value: string, label: string } objects
  // and sort them with guild members (by username) first.
  const uniqueOwnersForFilter = useMemo(() => {
    const ownersSet = new Set<string>();
    realms.forEach(realm => {
      if (realm.owner) {
        ownersSet.add(realm.owner);
      }
    });

    return Array.from(ownersSet)
      .map(ownerAddress => {
        const lowerOwnerAddress = ownerAddress.toLowerCase();
        const username = memberAddressToUsernameMap.get(lowerOwnerAddress);
        const isGuildMember = !!username;
        return {
          value: ownerAddress,
          label: username || `${ownerAddress.substring(0, 6)}...${ownerAddress.substring(ownerAddress.length - 4)}`,
          isGuildMember: isGuildMember,
          // Use username for sorting guild members, address for others
          sortKey: (isGuildMember ? username : ownerAddress).toLowerCase(), 
        };
      })
      .sort((a, b) => {
        // Sort guild members to the top
        if (a.isGuildMember && !b.isGuildMember) return -1;
        if (!a.isGuildMember && b.isGuildMember) return 1;
        // Then sort by username (for members) or address (for non-members)
        return a.sortKey.localeCompare(b.sortKey);
      });
  }, [realms, memberAddressToUsernameMap]);

  const filteredRealms = useMemo(() => {
    return realms.filter(realm => {
      const owner = realm.owner || '';
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        realm.name.toLowerCase().includes(search) ||
        owner.toLowerCase().includes(search) ||
        realm.id.toString().includes(search);
      const matchesResource = !selectedResource || realm.resources.some(r => r.resource === selectedResource);
      const matchesTroop = !selectedTroop || realm.availableTroops.includes(selectedTroop);
      const matchesOwner = !selectedOwnerFilter || owner === selectedOwnerFilter;
      const matchesGuildMembers = filterByGuildMembers ? guildMemberAddresses.has(owner.toLowerCase()) : true;
      return matchesSearch && matchesResource && matchesTroop && matchesOwner && matchesGuildMembers;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        return a.id - b.id;
      }
    });
  }, [realms, searchTerm, selectedResource, selectedTroop, selectedOwnerFilter, sortBy, filterByGuildMembers, guildMemberAddresses]);

  useEffect(() => {
    if (loading || isRefreshingOwners) {
      setIsProcessingFilters(false);
      return;
    }
    
    setIsProcessingFilters(true);
    
    const timer = setTimeout(() => {
      setIsProcessingFilters(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedResource, selectedTroop, selectedOwnerFilter, sortBy, loading, isRefreshingOwners]);

  const summaryRealms = filteredRealms;

  const summaryResourceCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    summaryRealms.forEach(realm => {
      realm.resources
        .filter(resource => !TROOP_IDS.includes(resource.resource))
        .forEach(resource => {
          counts[resource.resource] = (counts[resource.resource] || 0) + 1;
        });
    });
    return Object.entries(counts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .reduce((acc, [key, value]) => {
        acc[Number(key)] = value;
        return acc;
      }, {} as Record<number, number>);
  }, [summaryRealms]);

  const summaryTroopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    summaryRealms.forEach(realm => {
      realm.availableTroops.forEach(troop => {
        const name = ResourcesIds[troop];
        counts[name] = (counts[name] || 0) + 1;
      });
    });
    return counts;
  }, [summaryRealms]);

  const summaryWSCCount = useMemo(() => {
    return summaryRealms.filter(realm =>
      realm.resources.some(r => r.resource === ResourcesIds.Wood) &&
      realm.resources.some(r => r.resource === ResourcesIds.Stone) &&
      realm.resources.some(r => r.resource === ResourcesIds.Coal)
    ).length;
  }, [summaryRealms]);

  const handleExportExcel = () => {
    const data = filteredRealms.map(realm => ({
      ID: realm.id,
      Name: realm.name,
      Owner: realm.owner || '',
      WSC: realm.resources.some(r => r.resource === ResourcesIds.Wood) &&
           realm.resources.some(r => r.resource === ResourcesIds.Stone) &&
           realm.resources.some(r => r.resource === ResourcesIds.Coal) ? '✓' : '',
      Resources: realm.resources
        .filter(resource => !TROOP_IDS.includes(resource.resource))
        .sort((a, b) => a.resource - b.resource)
        .map(resource => ResourcesIds[resource.resource])
        .join(', '),
      Troops: realm.availableTroops
        .map(troop => ResourcesIds[troop])
        .join(', '),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'S1 Passes');
    XLSX.writeFile(workbook, 's1_passes_export.xlsx');
  };

  const handleRefreshOwners = async () => {
    setIsRefreshingOwners(true);
    console.log('Manual owner refresh triggered');
    try {
      // Call the backend API to trigger the update process
      const updateResponse = await fetch('/api/update-owners', {
        method: 'POST',
        // No body needed unless sending parameters
      });

      if (!updateResponse.ok) {
        // Try to get error message from response body
        let errorMsg = `API call failed with status ${updateResponse.status}`;
        try {
            const errorData = await updateResponse.json();
            errorMsg = errorData.error || errorMsg;
        } catch (_e) { /* ignore json parsing error */ }
        throw new Error(errorMsg);
      }

      const result = await updateResponse.json();
      console.log('Owner update API response:', result);

      // If update was successful, reload realm data from the primary API
      console.log('Reloading realm data from /api/realms...');
      const loadedRealms = await loadRealms(); // Fetches from /api/realms (which reads DB)
      setRealms(loadedRealms);
      console.log('Manual refresh complete, data reloaded.');

    } catch (error) {
      console.error('Error during manual owner refresh:', error);
      // Here you might want to show an error message to the user
      alert(`Failed to refresh owners: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRefreshingOwners(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard compact-list">
      <div className="dashboard-main-table">
        <div className="dashboard-header">
          <h1>S1 Season Pass Dashboard</h1>
        </div>
        <div className="filters">
          {/* Row 1: Filters */}
          <div className="filter-row">
            <select
              value={sortBy}
              onChange={(e) => {
                const value = e.target.value as 'name' | 'id';
                setIsProcessingFilters(true);
                setTimeout(() => {
                  setSortBy(value);
                  setIsProcessingFilters(false);
                }, 0);
              }}
              className="filter-select"
            >
              <option value="name">Sort by Name</option>
              <option value="id">Sort by ID</option>
            </select>
            <input
              type="text"
              placeholder="Search S1 Passes..."
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setIsProcessingFilters(true);
                setTimeout(() => {
                  setSearchTerm(value);
                  setIsProcessingFilters(false);
                }, 0);
              }}
              className="search-input"
            />
            <select
              value={selectedResource || ''}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : null;
                setIsProcessingFilters(true);
                setTimeout(() => {
                  setSelectedResource(value);
                  setIsProcessingFilters(false);
                }, 0);
              }}
              className="filter-select"
            >
              <option value="">All Resources</option>
              {Object.values(ResourcesIds)
                .filter((id): id is ResourcesIds => typeof id === 'number' && !TROOP_IDS.includes(id) && !EXCLUDED_RESOURCES.includes(id))
                .map((id) => (
                  <option key={`resource-${id}`} value={id}>
                    {ResourcesIds[id]}
                  </option>
                ))}
            </select>
            <select
              value={selectedTroop || ''}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : null;
                setIsProcessingFilters(true);
                setTimeout(() => {
                  setSelectedTroop(value);
                  setIsProcessingFilters(false);
                }, 0);
              }}
              className="filter-select"
            >
              <option value="">All Army Types</option>
              {TROOP_TYPES.map(({ key, value }) => (
                <option key={`troop-${value}`} value={value}>
                  {key}
                </option>
              ))}
            </select>
            <select
              value={selectedOwnerFilter}
              onChange={(e) => {
                const value = e.target.value;
                setIsProcessingFilters(true);
                setTimeout(() => {
                  setSelectedOwnerFilter(value);
                  setIsProcessingFilters(false);
                }, 0);
              }}
              className="filter-select"
            >
              <option value="">All Owners</option>
              {uniqueOwnersForFilter.map(owner => (
                <option key={owner.value} value={owner.value}>{owner.label}</option>
              ))}
            </select>
            <div className="filter-checkbox-wrapper" title={loadingMembers ? "Loading member list..." : ""}>
              <input 
                type="checkbox"
                id="guildFilterCheckbox"
                checked={filterByGuildMembers}
                disabled={loadingMembers}
                onChange={(_e) => {
                  const isChecked = _e.target.checked;
                  setIsProcessingFilters(true);
                  setTimeout(() => {
                    setFilterByGuildMembers(isChecked);
                    setIsProcessingFilters(false);
                  }, 0);
                }}
              />
              <label htmlFor="guildFilterCheckbox">Guild Members Only</label>
            </div>
          </div>
          
          {/* Row 2: Action Buttons */}
          <div className="action-buttons-row">
            <button
              className="clear-filters-btn"
              onClick={() => {
                setIsProcessingFilters(true);
                setTimeout(() => {
                  setSearchTerm('');
                  setSelectedResource(null);
                  setSelectedTroop(null);
                  setSelectedOwnerFilter('');
                  setFilterByGuildMembers(false);
                  setIsProcessingFilters(false);
                }, 0);
              }}
            >
              Clear Filters
            </button>
            <button
              className="refresh-owners-btn"
              onClick={handleRefreshOwners}
              disabled={isRefreshingOwners}
              style={{ marginLeft: '0.5rem', padding: '0.4rem 1rem', borderRadius: '4px', border: 'none', background: '#5a5a5a', color: '#fff', cursor: 'pointer', opacity: isRefreshingOwners ? 0.6 : 1 }}
            >
              {isRefreshingOwners ? 'Refreshing Owners...' : 'Refresh Owners'}
            </button>
            <button
              className="export-excel-btn"
              onClick={handleExportExcel}
              style={{ marginLeft: '0.5rem', padding: '0.4rem 1rem', borderRadius: '4px', border: 'none', background: '#8ec6ff', color: '#000', fontWeight: 600, cursor: 'pointer' }}
            >
              Export to Excel
            </button>
          </div>
        </div>
        <div className="realms-list-wrapper">
          {/* Conditionally render overlay */}
          {isProcessingFilters && (
            <div className="filtering-overlay">
              <div className="spinner"></div>
            </div>
          )}
          <div className="realms-list">
            <div className="realms-list-header">
              <span className="col-id">ID</span>
              <span className="col-name">Name</span>
              <span className="col-owner">Owner</span>
              <span className="col-wsc">WSC</span>
              <span className="col-resources">Resources</span>
              <span className="col-troops">Troops</span>
            </div>
            {filteredRealms.map((realm) => {
              const owner = realm.owner || '';
              const ownerLowercase = owner.toLowerCase();
              const isGuildMember = guildMemberAddresses.has(ownerLowercase);
              // Get username if owner is a guild member, otherwise use truncated address
              const displayOwner = isGuildMember 
                ? memberAddressToUsernameMap.get(ownerLowercase) || owner // Fallback to address if map somehow fails
                : owner ? `${owner.substring(0, 6)}...${owner.substring(owner.length - 4)}` : '-';
              
              const hasWSC = realm.resources.some(r => r.resource === ResourcesIds.Wood)
                && realm.resources.some(r => r.resource === ResourcesIds.Stone)
                && realm.resources.some(r => r.resource === ResourcesIds.Coal);
              return (
                <div
                  key={`realm-${realm.id}`}
                  className="realms-list-row"
                >
                  <span className="col-id">{realm.id}</span>
                  <span className="col-name">{realm.name}</span>
                  <span className="col-owner" title={owner}>
                    {displayOwner}
                  </span>
                  <span className="col-wsc">{hasWSC ? '✓' : ''}</span>
                  <span className="col-resources">
                    {realm.resources
                      .filter(resource => !TROOP_IDS.includes(resource.resource))
                      .slice()
                      .sort((a, b) => a.resource - b.resource)
                      .map((resource) => (
                        <span
                          key={`resource-${realm.id}-${resource.resource}`}
                          className="resource-pair"
                          data-rarity={RESOURCE_RARITY[resource.resource] || 'common'}
                        >
                          {ResourcesIds[resource.resource]}
                        </span>
                      ))}
                  </span>
                  <span className="col-troops">
                    {realm.availableTroops.map((troop) => {
                      const troopName = ResourcesIds[troop];
                      const tier = troopTierMap[troopName] || 'T1';
                      return (
                        <span key={`troop-${realm.id}-${troop}`} className="troop-pair" data-tier={tier}>{troopName}</span>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="dashboard-summary-panel">
        <h2>Display Summary</h2>
        <div><b>Passes displayed:</b> {summaryRealms.length}</div>
        <div><b>WSC number:</b> {summaryWSCCount}</div>
        <div style={{ marginTop: '1em' }}><b>Troops:</b></div>
        <ul>
          {Object.entries(summaryTroopCounts).map(([name, count]) => {
            const tier = troopTierMap[name] || 'T1';
            return (
              <li key={name}>
                <span className="troop-pair" data-tier={tier}>{name}</span>: {count}
              </li>
            );
          })}
        </ul>
        <div style={{ marginTop: '1em' }}><b>Resources:</b></div>
        <ul>
          {Object.entries(summaryResourceCounts).map(([id, count]) => {
            const resourceId = Number(id);
            const name = ResourcesIds[resourceId];
            const rarity = RESOURCE_RARITY[resourceId] || 'common';
            return (
              <li key={resourceId}>
                <span className="resource-pair" data-rarity={rarity}>{name}</span>: {count}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
