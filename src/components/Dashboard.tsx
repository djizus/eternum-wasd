import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Realm } from '../types/resources';
import { 
    RESOURCE_DEFINITIONS,
    getResourceDefinitionFromName,
    RESOURCE_BANDS
} from '../types/resources';
import { loadRealms } from '../services/realms';
import * as XLSX from 'xlsx';
import './Dashboard.css';

// List of resource IDs/names to exclude from the filter dropdown
const EXCLUDED_RESOURCES_NAMES = ['Labor', 'Ancient Fragment', 'Donkey', 'Lords', 'Wheat', 'Fish'];

interface Member {
  _id?: string; 
  address?: string;
  username?: string; 
  role?: 'warmonger' | 'farmer' | 'hybrid' | null; 
  realmCount?: number; 
}

// --- Helper: Normalize address --- 
// Updated to be consistent with LiveMapPage.tsx and /api/cartridge-usernames/route.ts
const normalizeDashboardAddress = (address: string | undefined): string | undefined => {
  if (!address) return undefined; // MODIFIED BODY
  const lowerAddress = address.toLowerCase();
  const stripped = lowerAddress.startsWith('0x') ? lowerAddress.slice(2) : lowerAddress;
  const normalizedHex = stripped.replace(/^0+/, '');
  if (normalizedHex === '') return '0x0';
  return '0x' + normalizedHex;
};

const Dashboard = () => {
  const [realms, setRealms] = useState<Realm[]>([]);
  const [guildMembersDetails, setGuildMembersDetails] = useState<Member[]>([]); 
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  // --- New State for Cartridge Usernames ---
  const [cartridgeUsernames, setCartridgeUsernames] = useState<Map<string, string>>(new Map());
  const [loadingCartridgeUsernames, setLoadingCartridgeUsernames] = useState<boolean>(true);
  // --- End New State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResource, setSelectedResource] = useState<string | null>(null); // Filter by resource name (string)
  const [selectedTroop, setSelectedTroop] = useState<string | null>(null); // State for troop filter
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('id');
  const [isProcessingFilters, setIsProcessingFilters] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [filterByGuildMembers, setFilterByGuildMembers] = useState<boolean>(true);
  const [memberAddressToUsernameMap, setMemberAddressToUsernameMap] = useState<Map<string, string>>(new Map());
  const [guildMemberAddresses, setGuildMemberAddresses] = useState<Set<string>>(new Set());

  const refreshData = useCallback(async () => {
    if (isRefreshingData) return; 
    setIsRefreshingData(true); 
    console.log('Manual data refresh triggered');
    try {
      const updateResponse = await fetch('/api/refresh-realms-data', {
        method: 'POST',
      });
      if (!updateResponse.ok) {
        let errorMsg = `API call failed with status ${updateResponse.status}`;
        try { const errorData = await updateResponse.json(); errorMsg = errorData.error || errorMsg; } catch (_e) { /* ignore */ }
        alert(`Error refreshing data: ${errorMsg}`); 
        throw new Error(errorMsg); 
      }
      const result = await updateResponse.json();
      console.log('Data refresh API response:', result);
      console.log('Reloading realm data from /api/realms...');
      const loadedRealms = await loadRealms(); 
      setRealms(loadedRealms);
      console.log('Manual refresh complete, data reloaded.');
    } catch (error) {
      console.error('Error during manual data refresh:', error);
    } finally {
      setIsRefreshingData(false); 
    }
  }, [isRefreshingData]); 

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setLoadingMembers(true);
      setLoadingCartridgeUsernames(true); // Initialize loading for Cartridge usernames
      try {
        const [loadedRealmsData, memberResponse] = await Promise.all([
          loadRealms(),
          fetch('/api/members') 
        ]);
        setRealms(loadedRealmsData); 

        if (memberResponse.ok) {
          const membersData: Member[] = await memberResponse.json();
          setGuildMembersDetails(membersData); 
          console.log(`Loaded ${membersData.length} guild member details.`);
        } else {
          console.error('Failed to fetch guild members:', memberResponse.statusText);
          setGuildMembersDetails([]); 
        }

        // --- Fetch Cartridge Usernames after realms are loaded ---
        if (loadedRealmsData && loadedRealmsData.length > 0) {
          const rawOwnerAddresses = Array.from(new Set(loadedRealmsData.map(r => r.owner).filter(Boolean))) as string[];
          
          // Normalize addresses on the client-side before sending to the API
          const normalizedOwnerAddressesForAPI = rawOwnerAddresses
            .map(addr => normalizeDashboardAddress(addr))
            .filter((addr): addr is string => !!addr); // Ensure only valid, non-null/undefined strings

          if (normalizedOwnerAddressesForAPI.length > 0) {
            console.log(`[Dashboard] Fetching Cartridge usernames for ${normalizedOwnerAddressesForAPI.length} normalized addresses...`);
            // console.log("[Dashboard] Normalized addresses being sent:", normalizedOwnerAddressesForAPI); // Optional: for debugging
            try {
              const cartridgeResponse = await fetch('/api/cartridge-usernames', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addresses: normalizedOwnerAddressesForAPI }), // Send normalized addresses
              });
              if (cartridgeResponse.ok) {
                const usernamesJson: Record<string, string> = await cartridgeResponse.json();
                const newCartridgeUsernamesMap = new Map<string, string>();
                for (const address in usernamesJson) {
                  // Addresses from Cartridge API are already normalized (lowercase, 0x-prefixed)
                  newCartridgeUsernamesMap.set(address, usernamesJson[address]);
                }
                setCartridgeUsernames(newCartridgeUsernamesMap);
                console.log(`[Dashboard] Fetched ${newCartridgeUsernamesMap.size} Cartridge usernames.`);
              } else {
                console.error('[Dashboard] Failed to fetch Cartridge usernames:', cartridgeResponse.statusText);
                setCartridgeUsernames(new Map()); // Set to empty on error
              }
            } catch (cartridgeErr) {
              console.error('[Dashboard] Error during fetch call to /api/cartridge-usernames:', cartridgeErr);
              setCartridgeUsernames(new Map()); // Set to empty on error
            }
          } else {
            setCartridgeUsernames(new Map()); // No owner addresses to fetch for
          }
        } else {
          setCartridgeUsernames(new Map()); // No realms loaded
        }
        // --- End Cartridge Username Fetch ---

      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
        setLoadingMembers(false);
        setLoadingCartridgeUsernames(false); // Set loading to false
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const map = new Map<string, string>();
    guildMembersDetails.forEach(member => {
      if (member.address && member.username) {
        const normalizedGuildMemberAddress = normalizeDashboardAddress(member.address);
        if (normalizedGuildMemberAddress) {
          map.set(normalizedGuildMemberAddress, member.username);
        }
      }
    });
    setMemberAddressToUsernameMap(map);
  }, [guildMembersDetails]);

  useEffect(() => {
    const addresses = new Set(memberAddressToUsernameMap.keys());
    setGuildMemberAddresses(addresses);
  }, [memberAddressToUsernameMap]);

  // --- New: Final combined address to username map (MOVED UP) ---
  const finalAddressToUsernameMap = useMemo(() => {
    const combinedMap = new Map<string, string>();

    // 1. Populate with Cartridge usernames (keys are already normalized by API)
    cartridgeUsernames.forEach((username, address) => {
        combinedMap.set(address, username);
    });

    // 2. Override with guild member usernames (these take precedence)
    // memberAddressToUsernameMap keys are already lowercased
    memberAddressToUsernameMap.forEach((username, address) => {
        combinedMap.set(address, username);
    });
    console.log(`[Dashboard] finalAddressToUsernameMap created with ${combinedMap.size} entries.`);
    return combinedMap;
  }, [cartridgeUsernames, memberAddressToUsernameMap]);
  // --- End Final Combined Map ---

  // --- Updated uniqueOwnersForFilter to use finalAddressToUsernameMap ---
  const uniqueOwnersForFilter = useMemo(() => {
    const ownersSet = new Set<string>();
    realms.forEach(realm => { if (realm.owner) { ownersSet.add(realm.owner); } });
    
    const mappedOwners = Array.from(ownersSet)
      .map(ownerAddress => {
        const currentOwnerAddress = ownerAddress || ''; 
        const normalizedAddr = normalizeDashboardAddress(currentOwnerAddress);
        
        const username = normalizedAddr ? finalAddressToUsernameMap.get(normalizedAddr) : undefined;
        const isGuildMember = normalizedAddr ? memberAddressToUsernameMap.has(normalizedAddr) : false; // Keep for now, might be used elsewhere or for secondary sort
        
        let sortKeyBase = username;
        if (!sortKeyBase && currentOwnerAddress) {
          sortKeyBase = currentOwnerAddress;
        }

        return {
          value: currentOwnerAddress,
          label: username || (currentOwnerAddress ? `${currentOwnerAddress.substring(0, 6)}...${currentOwnerAddress.substring(currentOwnerAddress.length - 4)}` : 'Unknown Owner'),
          isGuildMember: isGuildMember,
          sortKey: (sortKeyBase || '').toLowerCase(),
          hasUsername: !!username // Flag if a username exists for this owner
        };
      })
      .sort((a, b) => {
        // Prioritize items with usernames
        if (a.hasUsername && !b.hasUsername) {
          return -1; // a comes first
        }
        if (!a.hasUsername && b.hasUsername) {
          return 1; // b comes first
        }
        // If both have/don't have usernames, sort by the existing sortKey (username or address)
        return a.sortKey.localeCompare(b.sortKey);
      });
    
    return mappedOwners;
  }, [realms, finalAddressToUsernameMap, memberAddressToUsernameMap]); 
  // --- End Updated uniqueOwnersForFilter ---

  const filteredRealms = useMemo(() => {
    return realms.filter(realm => {
      const owner = realm.owner || '';
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        realm.name.toLowerCase().includes(search) ||
        owner.toLowerCase().includes(search) ||
        realm.id.toString().includes(search);

      // Filter by selected resource name (string), case-insensitive
      const matchesResource = !selectedResource || 
        realm.resources.some(rDef => rDef.name.toLowerCase() === selectedResource.toLowerCase());
      
      // Filter by selected troop
      const matchesTroop = !selectedTroop || realm.availableTroops.includes(selectedTroop);

      // Troop filter logic removed as realm.availableTroops is not available
      const matchesOwner = !selectedOwnerFilter || owner === selectedOwnerFilter;
      const matchesGuildMembers = filterByGuildMembers ? guildMemberAddresses.has(owner.toLowerCase()) : true;
      return matchesSearch && matchesResource && matchesTroop && matchesOwner && matchesGuildMembers;
    }).sort((a, b) => {
      if (sortBy === 'name') { return a.name.localeCompare(b.name); }
      else { return a.id - b.id; }
    });
  }, [realms, searchTerm, selectedResource, selectedTroop, selectedOwnerFilter, sortBy, filterByGuildMembers, guildMemberAddresses]);

  useEffect(() => {
    if (loading || loadingMembers || loadingCartridgeUsernames || isRefreshingData) {
      setIsProcessingFilters(false); 
      return; 
    }
    setIsProcessingFilters(true);
    const timer = setTimeout(() => { setIsProcessingFilters(false); }, 100);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedResource, selectedTroop, selectedOwnerFilter, sortBy, loading, loadingMembers, loadingCartridgeUsernames, isRefreshingData]);

  const summaryRealms = filteredRealms;

  const summaryResourceCounts = useMemo(() => {
    const counts: Record<string, number> = {}; 
    summaryRealms.forEach(realm => {
      realm.resources.forEach(rDef => {
        // Count only if it's not marked as 'troop' rarity
        if (rDef.rarity !== 'troop') {
          counts[rDef.name] = (counts[rDef.name] || 0) + 1;
        }
      });
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {} as Record<string, number>);
  }, [summaryRealms]);

  const summaryWSCCount = useMemo(() => {
    return summaryRealms.filter(realm => {
      const resourceNames = new Set(realm.resources.map(rDef => rDef.name.toLowerCase()));
      return resourceNames.has('wood') &&
             resourceNames.has('stone') &&
             resourceNames.has('coal');
    }).length;
  }, [summaryRealms]);

  // Calculate summary troop counts
  const summaryTroopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    summaryRealms.forEach(realm => {
      realm.availableTroops.forEach(troopName => {
        counts[troopName] = (counts[troopName] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically
      .reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {} as Record<string, number>);
  }, [summaryRealms]);

  const handleExportExcel = () => {
    const data = filteredRealms.map(realm => {
      const resourceNamesForWSC = new Set(realm.resources.map(rDef => rDef.name.toLowerCase()));
      const hasWSC = resourceNamesForWSC.has('wood') &&
                     resourceNamesForWSC.has('stone') &&
                     resourceNamesForWSC.has('coal');

      const displayResourceNames = realm.resources
          .filter(rDef => rDef.rarity !== 'troop' && !EXCLUDED_RESOURCES_NAMES.includes(rDef.name))
          .sort((a, b) => { // Sort by ID then name
            if (a.id < b.id) return -1;
            if (a.id > b.id) return 1;
            return a.name.localeCompare(b.name);
          })
          .map(rDef => rDef.name) // Map to names after sorting
          .join(', ');

      const displayTroops = realm.availableTroops.join(', ');

      return {
        ID: realm.id,
        Name: realm.name,
        Owner: realm.owner || '',
        WSC: hasWSC ? '✓' : '',
        Resources: displayResourceNames,
        Troops: displayTroops
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'S1 Passes');
    XLSX.writeFile(workbook, 's1_passes_export.xlsx');
  };

  if (loading || loadingMembers || loadingCartridgeUsernames) {
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
          <div className="filter-row">
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'id')} className="filter-select">
              <option value="name">Sort by Name</option>
              <option value="id">Sort by ID</option>
            </select>
            <input type="text" placeholder="Search S1 Passes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="search-input"/>
            <select value={selectedResource || ''} onChange={e => setSelectedResource(e.target.value || null)} className="filter-select">
              <option value="">All Resources</option>
              {RESOURCE_DEFINITIONS
                .filter(def => def.rarity !== 'troop' && !EXCLUDED_RESOURCES_NAMES.includes(def.name))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((def) => ( 
                  <option key={`resource-${def.id}`} value={def.name}>{def.name}</option>
                ))}
            </select>
            <select value={selectedTroop || ''} onChange={e => setSelectedTroop(e.target.value || null)} className="filter-select">
              <option value="">All Troops</option>
              {Object.keys(RESOURCE_BANDS).sort().map((troopName) => (
                <option key={`troop-${troopName}`} value={troopName}>{troopName}</option>
              ))}
            </select>
            <select value={selectedOwnerFilter} onChange={e => setSelectedOwnerFilter(e.target.value)} className="filter-select">
              <option value="">All Owners</option>
              {uniqueOwnersForFilter.map(owner => (<option key={owner.value} value={owner.value}>{owner.label}</option>))}
            </select>
            <div className="filter-checkbox-wrapper" title={loadingMembers ? "Loading member list..." : ""}>
              <input type="checkbox" id="guildFilterCheckbox" checked={filterByGuildMembers} disabled={loadingMembers} onChange={e => setFilterByGuildMembers(e.target.checked)}/>
              <label htmlFor="guildFilterCheckbox">Guild Members Only</label>
            </div>
          </div>
          <div className="action-buttons-row">
            <button className="clear-filters-btn" onClick={() => { setSearchTerm(''); setSelectedResource(null); setSelectedTroop(null); setSelectedOwnerFilter(''); setFilterByGuildMembers(false); }}>Clear Filters</button>
            <button className="export-excel-btn" onClick={handleExportExcel}>Export to Excel</button>
            <button className="refresh-owners-btn" onClick={refreshData} disabled={isRefreshingData}>{isRefreshingData ? 'Refreshing Data...' : 'Refresh Data'}</button>
          </div>
        </div>
        <div className="realms-list-wrapper">
          {isProcessingFilters && (<div className="filtering-overlay"><div className="spinner"></div></div>)}
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
              
              // --- UPDATED Owner Display Logic ---
              // Ensure 'owner' is treated as a string for normalizeDashboardAddress
              const normalizedOwnerForLookup = normalizeDashboardAddress(owner || '');
              let displayOwnerName = normalizedOwnerForLookup ? finalAddressToUsernameMap.get(normalizedOwnerForLookup) : undefined;

              if (!displayOwnerName && owner) {
                displayOwnerName = `${owner.substring(0, 6)}...${owner.substring(owner.length - 4)}`;
              } else if (!displayOwnerName) {
                displayOwnerName = '-';
              }
              // --- End UPDATED Owner Display Logic ---

              const resourceNamesForWSC = new Set(realm.resources.map(rDef => rDef.name.toLowerCase()));
              const hasWSC = resourceNamesForWSC.has('wood') && resourceNamesForWSC.has('stone') && resourceNamesForWSC.has('coal');

              return (
                <div key={`realm-${realm.id}`} className="realms-list-row">
                  <span className="col-id">{realm.id}</span>
                  <span className="col-name">{realm.name}</span>
                  <span className="col-owner" title={owner}>{displayOwnerName}</span>
                  <span className="col-wsc">{hasWSC ? '✓' : ''}</span>
                  <span className="col-resources">
                    {realm.resources
                       .filter(rDef => rDef.rarity !== 'troop') // Filter out troops from display
                       .sort((a, b) => { // Sort by ID then name
                         if (a.id < b.id) return -1;
                         if (a.id > b.id) return 1;
                         return a.name.localeCompare(b.name);
                       }) 
                       .map((rDef) => (
                         <span
                           key={`resource-${realm.id}-${rDef.id}`}
                           className="resource-pair"
                           data-rarity={rDef.rarity} 
                         >
                           {rDef.name} 
                         </span>
                       ))}
                  </span>
                  <span className="col-troops">
                    {realm.availableTroops.map(troopName => {
                      // Basic tier extraction from name like "KNIGHT_T2" -> "T2"
                      const tierMatch = troopName.match(/_T([1-3])$/);
                      const tier = tierMatch ? `T${tierMatch[1]}` : 'unknown'; 
                      return (
                        <span 
                          key={`troop-${realm.id}-${troopName}`} 
                          className="troop-tag" 
                          data-tier={tier} // Add data attribute for styling
                        >
                          {troopName}
                        </span>
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
        <div style={{ marginTop: '1em' }}><b>Resources:</b></div>
        <ul>
          {Object.entries(summaryResourceCounts).map(([resourceName, count]) => {
             const definition = getResourceDefinitionFromName(resourceName);
             const rarity = definition?.rarity || 'common'; 
            if (!resourceName) return null; 
            return (
              <li key={resourceName}>
                <span className="resource-pair" data-rarity={rarity}>{resourceName}</span>: {count}
              </li>
            );
          })}
        </ul>
        <div style={{ marginTop: '1em' }}><b>Available Troops:</b></div>
        <ul>
          {Object.entries(summaryTroopCounts).map(([troopName, count]) => {
            const tierMatch = troopName.match(/_T([1-3])$/);
            const tier = tierMatch ? `T${tierMatch[1]}` : 'unknown';
            return (
              <li key={`summary-troop-${troopName}`}>
                <span className="troop-tag" data-tier={tier}>{troopName}</span>: {count}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
