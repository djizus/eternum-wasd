'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import './EternumStructuresPage.css'; // Import the new CSS file
import { loadRealms } from '../services/realms'; // To fetch detailed realm data
import type { Realm as RealmDetails, ResourceDefinition } from '../types/resources'; // Types for realm and resources

// Helper to normalize addresses (similar to Dashboard.tsx)
const normalizeAddress = (address: string | undefined): string | undefined => {
  if (!address) return undefined;
  const lowerAddress = address.toLowerCase();
  const stripped = lowerAddress.startsWith('0x') ? lowerAddress.slice(2) : lowerAddress;
  const normalizedHex = stripped.replace(/^0+/, '');
  if (normalizedHex === '') return '0x0'; // Handle case of '0x000...0'
  return '0x' + normalizedHex;
};

// Original structure from API
interface EternumStructureFromAPI {
  'base.category': number;
  'base.coord_x': number;
  'base.coord_y': number;
  'base.created_at': number;
  'base.level': number;
  'base.troop_explorer_count': number;
  'base.troop_guard_count': number;
  'base.troop_max_explorer_count': number;
  'base.troop_max_guard_count': number;
  category: number;
  entity_id: number;
  internal_created_at: string;
  internal_entity_id: string;
  internal_event_id: string;
  internal_event_message_id: string | null;
  internal_executed_at: string;
  internal_id: string;
  internal_updated_at: string;
  'metadata.has_wonder': number;
  'metadata.order': number;
  'metadata.realm_id': number; // This is the crucial field, should be same as entity_id for category 1
  'metadata.village_realm': number;
  'metadata.villages_count': number;
  owner: string; // This is the raw address
  resources_packed: string;
  [key: string]: unknown; 
}

// ---- START TRIBE INTERFACES ----
interface TribeMemberInfo { // From /api/tribes
  guild_id: string;
  member: string; // Player address
  name: string;   // Hex-encoded guild name
  member_count: number;
  [key: string]: unknown;
}

interface ProcessedGuildInfo {
  id: string; // guild_id
  name: string; // Decoded name
  members: string[]; // Array of normalized member addresses
  memberCount: number;
}
// ---- END TRIBE INTERFACES ----

// Combined data structure for display
interface DisplayableStructure {
  entity_id: number;
  ownerDisplay: string; // Username or truncated address
  category: number; // Will be 1
  coord_x: number;
  coord_y: number;
  level: number;
  realmName: string; // Will be filtered if not present
  resources: ResourceDefinition[]; 
  availableTroops: string[];
  originalOwnerAddress: string; // Linter fix: was string? now string
  guardTroopsDisplay: string[] | null; // New field for guard troops
  villagesCount: number;
  tribeName?: string; // Optional: player might not be in a tribe
}

// Helper Function to Parse Troop Guards (adapted from LiveMapPage.tsx)
function parseTroopGuardsFromStructure(structureData: EternumStructureFromAPI | undefined): string[] | null {
  if (!structureData) return null;

  const troopCounts: { [key: string]: number } = {};
  let totalTroopCount = 0;

  for (const key in structureData) {
    if (key.startsWith('troop_guards.') && key.endsWith('.count')) {
      const parts = key.split('.');
      if (parts.length === 3) {
        const troopSlot = parts[1];
        const category = structureData[`troop_guards.${troopSlot}.category`] as string;
        const tier = structureData[`troop_guards.${troopSlot}.tier`] as string;
        const countHex = structureData[key] as string;

        if (category && tier && typeof countHex === 'string' && countHex.startsWith('0x')) {
          try {
            const count = parseInt(countHex, 16);
            if (!isNaN(count) && count > 0) {
              const troopKey = `${category}${tier}`;
              const adjustedCount = count / 1000000000; // Assuming this adjustment is correct
              if (adjustedCount > 0) {
                troopCounts[troopKey] = (troopCounts[troopKey] || 0) + adjustedCount;
                totalTroopCount += adjustedCount;
              }
            }
          } catch (e) {
            console.warn(`[EternumStructuresPage] Failed to parse troop count for ${key}: ${countHex}`, e);
          }
        }
      }
    }
  }

  if (totalTroopCount > 0) {
    return Object.entries(troopCounts)
                   .map(([type, num]) => `${num.toLocaleString()} ${type}`);
  }
  return null;
}

// ---- START hexToAscii HELPER ----
function hexToAscii(hexString: string): string {
  if (!hexString || typeof hexString !== 'string') {
    return "Unknown Name";
  }
  const cleanHexString = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  const finalHexString = cleanHexString.length % 2 !== 0 ? '0' + cleanHexString : cleanHexString;
  let asciiString = '';
  try {
    for (let i = 0; i < finalHexString.length; i += 2) {
      const charCode = parseInt(finalHexString.substring(i, i + 2), 16);
      if (charCode > 0) { 
          asciiString += String.fromCharCode(charCode);
      }
    }
    const trimmed = asciiString.replace(/\0+$/, '').trim();
    return trimmed.length > 0 ? trimmed : "Unnamed Tribe";
  } catch (e) {
    console.error("Error converting hex to ASCII:", hexString, e);
    return "Invalid Name";
  }
}
// ---- END hexToAscii HELPER ----

interface OwnerFilterOption {
  value: string; // Normalized address
  label: string; // Username or truncated address
}

// Add this helper function before the component
const downloadCSV = (data: string, filename: string) => {
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Helper to sum all troop_guards.*.count for a structure
function getTotalGuardTroops(structure: EternumStructureFromAPI): number {
  let total = 0;
  for (const key in structure) {
    if (key.startsWith('troop_guards.') && key.endsWith('.count')) {
      const countHex = structure[key] as string;
      if (typeof countHex === 'string' && countHex.startsWith('0x')) {
        const count = parseInt(countHex, 16) / 1e9;
        if (!isNaN(count)) {
          total += count;
        }
      }
    }
  }
  return total;
}

const EternumStructuresPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [structures, setStructures] = useState<EternumStructureFromAPI[]>([]);
  const [realmsData, setRealmsData] = useState<RealmDetails[]>([]);
  const [cartridgeUsernames, setCartridgeUsernames] = useState<Map<string, string>>(new Map());
  const [loadingStructures, setLoadingStructures] = useState(true);
  const [loadingRealms, setLoadingRealms] = useState(true);
  const [loadingUsernames, setLoadingUsernames] = useState(false); // Initially false, true when fetching
  const [error, setError] = useState<string | null>(null);

  // ---- START TRIBE STATE ----
  const [processedGuilds, setProcessedGuilds] = useState<Map<string, ProcessedGuildInfo>>(new Map());
  const [loadingTribes, setLoadingTribes] = useState(true);
  // Error state for tribes can be combined with the main `error` state or separate
  // For simplicity, using the main `error` state and appending context like [Tribes]
  // ---- END TRIBE STATE ----

  // Selected owner from URL, defaults to null if not present
  const selectedOwnerFromURL = useMemo(() => searchParams.get('owner'), [searchParams]);

  // New: Guard filter state from URL
  const guardFilterFromURL = useMemo(() => searchParams.get('guardFilter') === '1', [searchParams]);
  const [guardFilter, setGuardFilter] = useState(guardFilterFromURL);

  // ---- START TRIBE FILTER STATE ----
  const selectedTribeIdFromURL = useMemo(() => searchParams.get('tribeId'), [searchParams]);
  // No local state for selectedTribeId needed, directly use from URL for filtering
  // ---- END TRIBE FILTER STATE ----

  // Sync state with URL
  useEffect(() => {
    setGuardFilter(guardFilterFromURL);
  }, [guardFilterFromURL]);

  useEffect(() => {
    const fetchStructures = async () => {
      setLoadingStructures(true);
      setError(null);
      try {
        const response = await fetch('/api/eternum-structures');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error fetching structures: ${response.statusText}`);
        }
        const data: EternumStructureFromAPI[] = await response.json();
        setStructures(data);
      } catch (err: unknown) {
        console.error('Failed to load eternum structures:', err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred while fetching structures.';
        setError(prevError => prevError ? `${prevError}\n[Structures] ${message}` : `[Structures] ${message}`);
      } finally {
        setLoadingStructures(false);
      }
    };

    const fetchRealms = async () => {
      setLoadingRealms(true);
      try {
        const loadedRealms = await loadRealms();
        setRealmsData(loadedRealms);
      } catch (err: unknown) {
        console.error('Failed to load realm details:', err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred while fetching realm details.';
        setError(prevError => prevError ? `${prevError}\n[Realms] ${message}` : `[Realms] ${message}`);
      } finally {
        setLoadingRealms(false);
      }
    };

    // ---- START FETCH TRIBES ----
    const fetchTribes = async () => {
      setLoadingTribes(true);
      try {
        const response = await fetch('/api/tribes');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error fetching tribes: ${response.statusText}`);
        }
        const data: TribeMemberInfo[] = await response.json();
        // setRawTribesData(data); // rawTribesData is not used, so commenting out or removing

        // Process tribes data into a map of guildId to ProcessedGuildInfo
        const guilds = new Map<string, ProcessedGuildInfo>();
        data.forEach(memberInfo => {
          const normalizedMemberAddr = normalizeAddress(memberInfo.member);
          if (!normalizedMemberAddr) return; 

          if (!guilds.has(memberInfo.guild_id)) {
            guilds.set(memberInfo.guild_id, {
              id: memberInfo.guild_id,
              name: hexToAscii(memberInfo.name), // Decode hex name
              members: [],
              memberCount: memberInfo.member_count || 0,
            });
          }
          const guild = guilds.get(memberInfo.guild_id)!;
          if (!guild.members.includes(normalizedMemberAddr)) {
            guild.members.push(normalizedMemberAddr);
          }
          guild.memberCount = Math.max(guild.memberCount, memberInfo.member_count || 0);
        });
        setProcessedGuilds(guilds);

      } catch (err: unknown) {
        console.error('Failed to load tribes data:', err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred while fetching tribes.';
        setError(prevError => prevError ? `${prevError}\n[Tribes] ${message}` : `[Tribes] ${message}`);
      } finally {
        setLoadingTribes(false);
      }
    };
    // ---- END FETCH TRIBES ----

    fetchStructures();
    fetchRealms();
    fetchTribes(); // Call fetchTribes
  }, []);

  useEffect(() => {
    const fetchUsernames = async () => {
      // Ensure structures are loaded before trying to fetch usernames
      if (structures.length === 0 || loadingStructures) return;
      
      const relevantStructures = structures.filter(s => s.category === 1);
      if (relevantStructures.length === 0) {
        setLoadingUsernames(false); // No relevant structures, no usernames to load
        return;
      }

      setLoadingUsernames(true);
      try {
        const uniqueOwnerAddresses = Array.from(
          new Set(relevantStructures.map(s => normalizeAddress(s.owner)).filter(Boolean))
        ) as string[];
        
        if (uniqueOwnerAddresses.length > 0) {
          const response = await fetch('/api/cartridge-usernames', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses: uniqueOwnerAddresses }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error fetching usernames: ${response.statusText}`);
          }
          const usernamesJson: Record<string, string> = await response.json();
          const newUsernamesMap = new Map<string, string>();
          for (const address in usernamesJson) {
            // API returns normalized addresses as keys
            newUsernamesMap.set(address, usernamesJson[address]);
          }
          setCartridgeUsernames(newUsernamesMap);
        }
      } catch (err: unknown) {
        console.error('Failed to load cartridge usernames:', err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred while fetching usernames.';
        setError(prevError => prevError ? `${prevError}\n[Usernames] ${message}` : `[Usernames] ${message}`);
      } finally {
        setLoadingUsernames(false);
      }
    };
    // Trigger fetchUsernames when structures are loaded and not empty
    fetchUsernames(); 
  }, [structures, loadingStructures]); // Dependency remains on structures and its loading state

  // ---- START playerToTribeMap ----
  const playerToTribeMap = useMemo(() => {
    const map = new Map<string, { guildId: string, guildName: string }>();
    if (processedGuilds.size === 0) return map;
    processedGuilds.forEach(guild => {
      guild.members.forEach(memberAddress => {
        map.set(memberAddress, { 
          guildId: guild.id, 
          guildName: guild.name, 
        });
      });
    });
    return map;
  }, [processedGuilds]);
  // ---- END playerToTribeMap ----

  // ---- START UNIQUE TRIBE OPTIONS FOR FILTER ----
  const uniqueTribeOptions = useMemo(() => {
    if (processedGuilds.size === 0) return [];
    const options: Array<{ value: string; label: string }> = Array.from(processedGuilds.values())
      .map(guild => ({
        value: guild.id,
        label: guild.name || 'Unnamed Tribe',
      }))
      .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    return options;
  }, [processedGuilds]);
  // ---- END UNIQUE TRIBE OPTIONS FOR FILTER ----

  const uniqueOwnerOptions = useMemo(() => {
    // This can still compute based on available structures and usernames map,
    // it doesn't need to wait for loadingUsernames to be false.
    if (structures.length === 0) return [];
    const ownerMap = new Map<string, string>();
    structures.filter(s => s.category === 1).forEach(structure => {
      if (structure.owner) {
        const normalizedAddr = normalizeAddress(structure.owner);
        if (normalizedAddr && !ownerMap.has(normalizedAddr)) {
          const username = cartridgeUsernames.get(normalizedAddr);
          const label = username || `${normalizedAddr.substring(0, 6)}...${normalizedAddr.substring(normalizedAddr.length - 4)}`;
          ownerMap.set(normalizedAddr, label);
        }
      }
    });
    const options: OwnerFilterOption[] = Array.from(ownerMap, ([value, label]) => ({ value, label }));
    return options.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
  }, [structures, cartridgeUsernames]);

  const handleOwnerFilterChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newOwner = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (newOwner) {
      params.set('owner', newOwner);
    } else {
      params.delete('owner');
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  // ---- START TRIBE FILTER CHANGE HANDLER ----
  const handleTribeFilterChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newTribeId = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (newTribeId) {
      params.set('tribeId', newTribeId);
    } else {
      params.delete('tribeId');
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);
  // ---- END TRIBE FILTER CHANGE HANDLER ----

  // Handler for guard filter toggle
  const handleGuardFilterChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setGuardFilter(checked);
    const params = new URLSearchParams(searchParams.toString());
    if (checked) {
      params.set('guardFilter', '1');
    } else {
      params.delete('guardFilter');
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const combinedAndFilteredStructures = useMemo(() => {
    // Initial guard: If foundational data is still loading and not yet available, return empty.
    if ((loadingStructures && structures.length === 0) || 
        (loadingRealms && realmsData.length === 0)) {
      return [];
    }

    // If foundational data is present, but enrichment data (usernames, tribes) is loading for category 1 structures,
    // also return empty to prevent showing items before they are fully processed.
    const category1StructuresExist = structures.some(s => s.category === 1);
    if (category1StructuresExist && (loadingUsernames || loadingTribes)) {
      return [];
    }

    const mappedStructures = structures
      .filter(s => s.category === 1)
      .filter(s => { // Guard filter
        if (!guardFilter) return true;
        
        const noGuards = s['base.troop_guard_count'] === 0;
        const lowGuards = getTotalGuardTroops(s) <= 900;
        const fewVillages = (s['metadata.villages_count'] || 0) < 6;

        return (noGuards || lowGuards) && fewVillages;
      })
      .map(structure => {
        const realmsMap = new Map(realmsData.map(r => [r.id, r]));
        const realmDetail = realmsMap.get(structure['metadata.realm_id']);
        const realmName = realmDetail?.name;

        if (!realmName) return null; 

        const normalizedOwner = normalizeAddress(structure.owner);
        const username = normalizedOwner ? cartridgeUsernames.get(normalizedOwner) : undefined;
        const ownerDisplay = username || (structure.owner ? `${structure.owner.substring(0, 6)}...${structure.owner.substring(structure.owner.length - 4)}` : 'N/A');
        
        const guardTroopsDisplay = parseTroopGuardsFromStructure(structure);
        const villagesCount = structure['metadata.villages_count'] || 0; 
        const tribeInfo = normalizedOwner ? playerToTribeMap.get(normalizedOwner) : undefined;
        const tribeName = tribeInfo?.guildName;
        const tribeId = tribeInfo?.guildId; // Get tribeId for filtering

        // Explicitly return type that matches DisplayableStructure or null
        const displayableObj: Omit<DisplayableStructure, 'category' | 'coord_x' | 'coord_y'> & { entity_id: number, ownerTribeId?: string } = {
          entity_id: structure.entity_id,
          ownerDisplay: ownerDisplay,
          level: structure['base.level'],
          realmName: realmName,
          resources: realmDetail?.resources || [],
          availableTroops: realmDetail?.availableTroops || [],
          originalOwnerAddress: structure.owner,
          guardTroopsDisplay: guardTroopsDisplay,
          villagesCount: villagesCount, 
          tribeName: tribeName, 
          ownerTribeId: tribeId, // Add owner's tribe ID to the mapped object
        };
        return displayableObj as DisplayableStructure & { ownerTribeId?: string }; // Cast here after ensuring all required fields are present
      })
      .filter(s => s !== null); // Filter out nulls first

    // Now, mappedStructures is an array of non-null DisplayableStructure objects (potentially empty)
    // So, we can safely cast it for further operations if needed, or use directly.
    let fullyProcessedStructures = mappedStructures as Array<DisplayableStructure & { ownerTribeId?: string }>;

    if (selectedOwnerFromURL) {
      fullyProcessedStructures = fullyProcessedStructures.filter(
        s => normalizeAddress(s.originalOwnerAddress) === selectedOwnerFromURL
      );
    }
    
    // ---- START APPLY TRIBE FILTER ----
    if (selectedTribeIdFromURL) {
      fullyProcessedStructures = fullyProcessedStructures.filter(
        s => s.ownerTribeId === selectedTribeIdFromURL
      );
    }
    // ---- END APPLY TRIBE FILTER ----
    
    return fullyProcessedStructures.sort((a, b) => {
      // Sort by Tribe Name (treat 'N/A' or undefined as last)
      const tribeA = a.tribeName || 'zzzz'; // Push N/A or undefined to the end
      const tribeB = b.tribeName || 'zzzz';
      if (tribeA.toLowerCase() < tribeB.toLowerCase()) return -1;
      if (tribeA.toLowerCase() > tribeB.toLowerCase()) return 1;

      // Then by Owner Display Name
      if (a.ownerDisplay.toLowerCase() < b.ownerDisplay.toLowerCase()) return -1;
      if (a.ownerDisplay.toLowerCase() > b.ownerDisplay.toLowerCase()) return 1;

      // Finally by Entity ID
      return a.entity_id - b.entity_id;
    });
  }, [
    structures, 
    realmsData, 
    cartridgeUsernames, 
    loadingStructures, 
    loadingRealms, 
    loadingUsernames, 
    loadingTribes, 
    selectedOwnerFromURL, 
    selectedTribeIdFromURL, // Add selectedTribeIdFromURL to dependencies
    guardFilter,
    playerToTribeMap
  ]);

  const handleExportToExcel = useCallback(() => {
    if (combinedAndFilteredStructures.length === 0) return;
    const headers = [
      'Entity ID',
      'Owner',
      'Owner Address',
      'Level',
      'Realm Name',
      'Villages', // New Header
      'Tribe',    // New Header
      'Resources',
      'Available Troops',
      'Guard Troops'
    ];
    const rows = combinedAndFilteredStructures.map(structure => [
      structure.entity_id,
      structure.ownerDisplay,
      structure.originalOwnerAddress,
      structure.level,
      structure.realmName,
      structure.villagesCount, // New Data
      structure.tribeName || 'N/A', // New Data
      structure.resources
        .filter(rDef => rDef.rarity !== 'troop')
        .map(rDef => rDef.name)
        .join(', '),
      structure.availableTroops.join(', '),
      structure.guardTroopsDisplay ? structure.guardTroopsDisplay.join('; ') : 'N/A'
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `eternum-structures-${date}.csv`;

    // Trigger download
    downloadCSV(csvContent, filename);
  }, [combinedAndFilteredStructures]);

  const isLoading = loadingStructures || loadingRealms || loadingUsernames || loadingTribes; // Add loadingTribes

  if (isLoading && combinedAndFilteredStructures.length === 0) {
    return <div className="eternum-structures-container loading-message"><p>Loading data...</p></div>;
  }

  // Error display: Show if critical fetch failed or if all fetches done and still no data
  if (error && combinedAndFilteredStructures.length === 0 && !isLoading) {
    return <div className="eternum-structures-container error-message"><p>Error loading data: {error.split('\n').map((str, index) => <span key={index}>{str}<br/></span>)}</p></div>;
  }
  
  // No data display: if not loading, no error that prevented all data, but still no items
  if (!isLoading && combinedAndFilteredStructures.length === 0 && !error) { 
    const message = selectedOwnerFromURL 
      ? `No Eternum structures found for owner: ${cartridgeUsernames.get(selectedOwnerFromURL) || selectedOwnerFromURL.substring(0,8)}...`
      : "No Eternum structures (Category 1 with Realm Name) found.";
    return <div className="eternum-structures-container no-data-message"><p>{message}</p></div>;
  }
  
  // Handle case where some data is loaded but there might have been partial errors (e.g. usernames failed but structures/realms okay)
  const showWarning = error && combinedAndFilteredStructures.length > 0;

  return (
    <div className="eternum-structures-container">
      {showWarning && <div className="warning-message"><p>Partial data warning: {error.split('\n').map((str, index) => <span key={index}>{str}<br/></span>)}</p></div>} 
      
      <div className="filters-container">
        <div className="filter-item">
          <label htmlFor="owner-filter">Filter by Owner:</label>
          <select id="owner-filter" value={selectedOwnerFromURL || ''} onChange={handleOwnerFilterChange}>
            <option value="">All Owners</option>
            {uniqueOwnerOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* ---- START TRIBE FILTER DROPDOWN ---- */}
        <div className="filter-item">
          <label htmlFor="tribe-filter">Filter by Tribe:</label>
          <select id="tribe-filter" value={selectedTribeIdFromURL || ''} onChange={handleTribeFilterChange}>
            <option value="">All Tribes</option>
            {uniqueTribeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        {/* ---- END TRIBE FILTER DROPDOWN ---- */}

        <div className="filter-item">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={guardFilter}
              onChange={handleGuardFilterChange}
              style={{ marginRight: 6 }}
            />
            Realms that can be spawn killed by villages
          </label>
        </div>

        <div className="filter-item">
          <button 
            onClick={handleExportToExcel}
            disabled={combinedAndFilteredStructures.length === 0}
            className="export-button"
          >
            Export to Excel
          </button>
        </div>
      </div>

      <div className="eternum-table-container">
        <table className="eternum-structures-table">
          <thead>
            <tr>
              <th>Entity ID</th>
              <th>Owner</th>
              <th>Level</th>
              <th>Realm Name</th>
              <th>Villages</th>
              <th>Tribe</th>
              <th>Resources</th>
              <th>Troops (Available)</th>
              <th>Guard Troops</th>
            </tr>
          </thead>
          <tbody>
            {combinedAndFilteredStructures.map((structure) => (
              <tr key={structure.entity_id}>
                <td>{structure.entity_id}</td>
                <td className="col-owner" title={structure.originalOwnerAddress}>{structure.ownerDisplay}</td>
                <td>{structure.level}</td>
                <td className="col-realm-name">{structure.realmName}</td>
                <td>{structure.villagesCount.toLocaleString()}</td>
                <td>{structure.tribeName || 'N/A'}</td>
                <td className="col-resources">
                  {structure.resources
                    .filter(rDef => rDef.rarity !== 'troop')
                    .sort((a, b) => {
                      if (a.id < b.id) return -1;
                      if (a.id > b.id) return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((rDef) => (
                      <span
                        key={`resource-${structure.entity_id}-${rDef.id}`}
                        className="resource-pair"
                        data-rarity={rDef.rarity}
                      >
                        {rDef.name}
                      </span>
                    ))}
                </td>
                <td className="col-troops">
                  {structure.availableTroops.map(troopName => {
                    const tierMatch = troopName.match(/_T([1-3])$/);
                    const tier = tierMatch ? `T${tierMatch[1]}` : 'unknown';
                    return (
                      <span
                        key={`troop-${structure.entity_id}-${troopName}`}
                        className="troop-tag"
                        data-tier={tier}
                      >
                        {troopName}
                      </span>
                    );
                  })}
                </td>
                <td className="col-guard-troops">
                  {structure.guardTroopsDisplay && structure.guardTroopsDisplay.length > 0 ? (
                    structure.guardTroopsDisplay.map((troopEntry, index) => (
                      <div key={`guard-troop-${structure.entity_id}-${index}`} className="guard-troop-entry">
                        {troopEntry}
                      </div>
                    ))
                  ) : (
                    <span>N/A</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isLoading && combinedAndFilteredStructures.length > 0 && (
        <div className="loading-message"><p>Updating data...</p></div>
      )}
    </div>
  );
};

export default EternumStructuresPage; 