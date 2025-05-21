import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import './LiveMapPage.css'; // We'll create this CSS file next
import HexagonTile from './HexagonTile'; // Import the new component
import type { ResourceDefinition } from '../types/resources'; // Import ResourceDefinition
import { getResourceDefinitionFromName, RESOURCE_DEFINITIONS, EXCLUDED_RESOURCES } from '../types/resources'; // Import lookup, definitions, and exclusions

// Define interfaces based on your JSON structure (can be expanded later)
interface MapCenter {
  x: number; // These are normalizedX for the center tile
  y: number; // These are normalizedY for the center tile
  originalContractX?: number;
  originalContractY?: number;
}

// Interface for individual spots (used in allPotentialSpots, banks, and as values in occupiedContractSpots)
interface HexSpot {
  normalizedX: number;
  normalizedY: number;
  originalContractX: number;
  originalContractY: number;
  side: number;      // Meaning to be clarified if important for rendering/logic
  layer: number;
  point: number;
  ownerAddress?: string; // Added for occupied spots & banks from structure data
  ownerName?: string;    // Added for occupied spots
  original_structure_data?: GenericStructure; // New: To store full structure data for banks
}


// Combined type for selected hex data to include a 'type' and all possible fields
interface SelectedHexData extends Partial<HexSpot> { // Most fields from HexSpot are optional
  type: string;
  normalizedX: number; // Ensure these are present
  normalizedY: number;
  originalContractX?: number; // Explicitly optional
  originalContractY?: number; // Explicitly optional
  ownerAddress?: string; // Added
  ownerName?: string;    // Added
  // MapCenter specific fields are already covered by Partial<HexSpot> or are x/y renamed
  x?: number; // from MapCenter, will be mapped to normalizedX
  y?: number; // from MapCenter, will be mapped to normalizedY
  realmName?: string;
  isWonder: boolean;
  // Add fields for new display requirements
  realmId?: number; 
  resourcesToDisplay?: ResourceDefinition[] | null; // Store resource objects for styling
  guardTroopsInfo?: string[] | null; // New: array of strings for multi-line display or null
  villagesCount?: number;   // New: For displaying village count
  tribeId?: string; // New: For tribe information
  tribeName?: string; // New: For tribe information
}

interface MapData {
  maxLayers: number;
  center: MapCenter;
  banks: HexSpot[]; // Assuming banks also follow the HexSpot structure, will be augmented with owner
  allPotentialSpots: HexSpot[]; // Keep for coordinate lookup
  // zones: Zone[]; // REMOVED
}

// Interface for Structure API return (generic structure)
// Using bracket notation for keys with '.'
interface GenericStructure {
  'base.category': number;
  'base.coord_x': number;
  'base.coord_y': number;
  'base.created_at': number;
  'base.level': number;
  'base.troop_explorer_count': number;
  'base.troop_guard_count': number;
  'base.troop_max_explorer_count': number;
  'base.troop_max_guard_count': number;
  category: number; // This seems redundant if base.category is primary
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
  'metadata.realm_id': number;
  'metadata.village_realm': number;
  'metadata.villages_count': number;
  owner: string; // This is the owner_address
  resources_packed: string;
  // troop_explorers and troop_guards are complex, define if needed
  [key: string]: unknown; // Changed from any to unknown for better type safety
}


// Specific data structure for Realms (Category 1)
interface RealmStructureData {
  entity_id: number;       // from top-level entity_id of the structure
  owner_address: string;   // from 'owner' field of the structure
  is_wonder: boolean;        // derived from 'metadata.has_wonder' (true if 1)
  x: number;               // from 'base.coord_x'
  y: number;               // from 'base.coord_y'
  metadata_realm_id: number; // from 'metadata.realm_id', used for linking to /api/realms
  // Original structure data can be included if needed for direct access later
  original_structure_data: GenericStructure; // Store the whole thing for flexibility
}

type VillageStructureData = GenericStructure;

interface RealmResourceInfo { // Aligning with the structure from loadRealms /api/realms
  id: number; // Realm ID (this will be metadata_realm_id from RealmStructureData)
  name: string; // Realm Name from MongoDB
  resources: ResourceDefinition[]; // Use imported ResourceDefinition type
}

const HEX_SIZE = 5; // Increased slightly to reduce visual gaps
const DEFAULT_FILL_COLOR = '#44475a'; // A slightly lighter dark grey
const OCCUPIED_FILL_COLOR = '#8B0000'; // Darker Red (Maroon/DarkRed)
const BANK_FILL_COLOR = '#f8f9fa';    // Very light grey / off-white for Banks
const BANK_STROKE_COLOR = '#34d399';  // A brighter green stroke for Banks
const CENTER_TILE_FILL_COLOR = '#e9ecef'; // Slightly different light grey for Center
const CENTER_TILE_STROKE_COLOR = '#fab005'; // A gold/yellow stroke for Center
const STROKE_COLOR = '#212529'; // Darker base stroke
const HEX_STROKE_WIDTH = 0.15; // Even thinner for less visual clutter with bright zones
const SPECIAL_TILE_STROKE_WIDTH = 0.4;
const FREE_POTENTIAL_SPOT_FILL_COLOR = '#2a2c38'; // Significantly darker shade for free spots

// const PLAYER_HIGHLIGHT_COLOR = '#00ced1'; // Dark Turquoise - distinct from resource green // REMOVED

// Helper function to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [255 * f(0), 255 * f(8), 255 * f(4)];
}

// Helper function to convert RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

// Helper function to convert HSL to Hex string
function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

// ---- START hexToAscii HELPER (copied from EternumStructuresPage) ----
function hexToAscii(hexString: string): string {
  if (!hexString || typeof hexString !== 'string') {
    return "Unknown Name";
  }
  const cleanHexString = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  // Ensure the string has an even length by prepending '0' if necessary
  const finalHexString = cleanHexString.length % 2 !== 0 ? '0' + cleanHexString : cleanHexString;
  let asciiString = '';
  try {
    for (let i = 0; i < finalHexString.length; i += 2) {
      const charCode = parseInt(finalHexString.substring(i, i + 2), 16);
      if (charCode > 0) { // Avoid null characters in the middle if not intended
          asciiString += String.fromCharCode(charCode);
      }
    }
    // Remove trailing null characters and trim whitespace
    const trimmed = asciiString.replace(/\0+$/, '').trim();
    return trimmed.length > 0 ? trimmed : "Unnamed Tribe";
  } catch (e) {
    console.error("Error converting hex to ASCII:", hexString, e);
    return "Invalid Name"; // Or handle error as appropriate
  }
}
// ---- END hexToAscii HELPER ----

// --- Updated Helper Function for Village Density Color (Green-Yellow-Red) ---
const VILLAGE_DENSITY_SATURATION_GYR = 90; // High saturation for vivid colors
const VILLAGE_DENSITY_LIGHTNESS_GYR = 55;  // A balanced lightness

const GREEN_HUE = 120;
const YELLOW_HUE = 60;
const RED_HUE = 0;

function getVillageDensityColor(count: number, maxCount: number): string {
  if (count <= 0) return DEFAULT_FILL_COLOR;

  const MAPPED_MAX_COUNT = Math.max(1, maxCount);
  let ratio = count / MAPPED_MAX_COUNT;
  ratio = Math.min(Math.max(ratio, 0.01), 1); // Clamp ratio, ensure a tiny village gets some color

  let hue;
  if (ratio <= 0.5) {
    // Interpolate from Green to Yellow for the first half
    const firstHalfRatio = ratio / 0.5; // Normalize ratio for 0-0.5 range to 0-1
    hue = GREEN_HUE - (GREEN_HUE - YELLOW_HUE) * firstHalfRatio;
  } else {
    // Interpolate from Yellow to Red for the second half
    const secondHalfRatio = (ratio - 0.5) / 0.5; // Normalize ratio for 0.5-1 range to 0-1
    hue = YELLOW_HUE - (YELLOW_HUE - RED_HUE) * secondHalfRatio;
  }
  
  return hslToHex(hue, VILLAGE_DENSITY_SATURATION_GYR, VILLAGE_DENSITY_LIGHTNESS_GYR);
}
// --- End Updated Helper Function ---

// Function to generate a diverse color palette
function generateMemberColors(count: number, baseSaturation: number, baseLightness: number): string[] {
  const colors: string[] = [];
  const minHue = 80; // Start from greenish-yellow/green
  const maxHue = 330; // End at magenta/violet, avoiding reds and oranges
  const hueRange = maxHue - minHue;

  // Define oscillation patterns for saturation and lightness
  const saturationOffsets = [0, 5, -5, 3, -3]; // e.g. 75, 80, 70, 78, 72 if baseSaturation is 75
  const lightnessOffsets = [0, -5, 5, -3, 3];  // e.g. 60, 55, 65, 57, 63 if baseLightness is 60

  for (let i = 0; i < count; i++) {
    const hue = minHue + (i / count) * hueRange; 
    
    let currentSaturation = baseSaturation + saturationOffsets[i % saturationOffsets.length];
    let currentLightness = baseLightness + lightnessOffsets[i % lightnessOffsets.length];

    // Clamp values to ensure they are reasonable (e.g., S: 40-90, L: 30-80)
    currentSaturation = Math.max(40, Math.min(90, currentSaturation));
    currentLightness = Math.max(30, Math.min(80, currentLightness));

    colors.push(hslToHex(hue, currentSaturation, currentLightness));
  }
  return colors;
}

// Generate 50 distinct colors
const MEMBER_COLORS: string[] = generateMemberColors(50, 75, 60); // Saturation: 75%, Lightness: 60%

// Replaced with user-provided normalization function, renamed for consistency
const normalizeAddress = (address: string | undefined): string | undefined => {
  if (!address) return address; // Return undefined if address is undefined
  // Remove '0x' prefix, remove leading zeros, then add '0x' back and convert to lowercase
  const stripped = address.toLowerCase().startsWith('0x') ? address.toLowerCase().slice(2) : address.toLowerCase();
  const normalizedHex = stripped.replace(/^0+/, '');
  // Ensure the result is not just '0x' if the original address was e.g. '0x000'
  if (normalizedHex === '') return '0x0'; 
  return '0x' + normalizedHex;
};

// Define Member interface based on findings in other components
interface Member {
  _id?: string;
  address?: string;
  username?: string;
}

// Type for the response from /api/cartridge-usernames
type CartridgeUsernamesResponse = Record<string, string>;

// ---- START TRIBE INTERFACES (copied from EternumStructuresPage) ----
interface TribeMemberInfo { // From /api/tribes
  guild_id: string;
  member: string; // Player address
  name: string;   // Hex-encoded guild name
  member_count: number; // Add member_count
  [key: string]: unknown; // Allow other fields
}

interface ProcessedGuildInfo {
  id: string; // guild_id
  name: string; // Decoded name
  members: string[]; // Array of normalized member addresses
  memberCount: number;
}
// ---- END TRIBE INTERFACES ----

const LiveMapPage: React.FC = () => {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHex, setSelectedHex] = useState<SelectedHexData | null>(null); 
  const [guildMembers, setGuildMembers] = useState<Member[]>([]); // Store full Member objects
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true); 
  // --- New State for Cartridge Usernames ---
  const [cartridgeUsernames, setCartridgeUsernames] = useState<Map<string, string>>(new Map());
  const [loadingCartridgeUsernames, setLoadingCartridgeUsernames] = useState<boolean>(true);
  // --- End New State ---
  const [zoomLevel, setZoomLevel] = useState<number>(1); // Add zoom state
  // Add state for panning
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [startDragPos, setStartDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewBoxOffset, setViewBoxOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialViewBoxOffset, setInitialViewBoxOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [realmStructuresData, setRealmStructuresData] = useState<RealmStructureData[]>([]); 
  const [loadingStructuresData, setLoadingStructuresData] = useState<boolean>(true);
  // Add state for Village Data (from structures) - prefixed with _ as it's not yet read
  const [_villageStructuresData, setVillageStructuresData] = useState<VillageStructureData[]>([]);
  // Add state for Realm Resource data
  const [realmResourceData, setRealmResourceData] = useState<RealmResourceInfo[]>([]);
  const [loadingRealmResources, setLoadingRealmResources] = useState<boolean>(true);
  // --- New State for Layers ---
  const [selectedLayer, setSelectedLayer] = useState<'guild' | 'resource' | 'village' | 'player' | 'tribe'>('guild');
  const [selectedResourceHighlight, setSelectedResourceHighlight] = useState<string | null>('Dragonhide'); // Default to Dragonhide
  const [selectedPlayerAddressHighlight, setSelectedPlayerAddressHighlight] = useState<string | null>(null); // For Player Search layer
  // Tribe layer state
  const [selectedTribeId, setSelectedTribeId] = useState<string | null>(null);
  // ---------------------------

  // ---- START TRIBE STATE ----
  const [processedGuilds, setProcessedGuilds] = useState<Map<string, ProcessedGuildInfo>>(new Map());
  const [loadingTribes, setLoadingTribes] = useState<boolean>(true);
  // ---- END TRIBE STATE ----

  // Ref for the SVG element
  const svgRef = useRef<SVGSVGElement>(null);

  const bankSpotsSet = useMemo(() => {
    if (!mapData) return new Set<string>();
    const set = new Set<string>();
    mapData.banks.forEach(bank => set.add(`${bank.originalContractX}-${bank.originalContractY}`));
    return set;
  }, [mapData]);

  const memberToColorMap = useMemo(() => {
    const map = new Map<string, string>();
    guildMembers.forEach((member, index) => { // Iterate over guildMembers
      if (member.address) {
        map.set(normalizeAddress(member.address)!, MEMBER_COLORS[index % MEMBER_COLORS.length]);
      }
    });
    return map;
  }, [guildMembers]); 

  // New: Map for RealmStructureData lookup
  const realmStructureMap = useMemo(() => {
    const map = new Map<string, RealmStructureData>();
    realmStructuresData.forEach(info => {
      // Use the x and y from RealmStructureData as the key
      map.set(`${info.x}-${info.y}`, info);
    });
    return map;
  }, [realmStructuresData]);

  // New: Map for Realm Resource lookup (Realm ID (metadata_realm_id) -> Full RealmResourceInfo)
  const realmResourceMap = useMemo(() => {
    console.log("[liveMapPage] Creating realmResourceMap...");
    const map = new Map<number, RealmResourceInfo>(); // Key is now number (metadata_realm_id)
    realmResourceData.forEach(realm => {
      if (realm.id) { // Ensure id exists before using it as key
        map.set(realm.id, realm); // Use realm.id (which corresponds to metadata_realm_id) as key
      } else {
        console.warn("[liveMapPage] Realm found with no id in realmResourceData:", realm);
      }
    });
    return map;
  }, [realmResourceData]);

  // Define highlight color constant
  const RESOURCE_HIGHLIGHT_COLOR = '#2ecc71'; // Green color

  // New: Create a lookup map for potential spots based on original contract coords
  const potentialSpotsMap = useMemo(() => {
    if (!mapData) return new Map<string, HexSpot>();
    const map = new Map<string, HexSpot>();
    mapData.allPotentialSpots.forEach(spot => {
      map.set(`${spot.originalContractX}-${spot.originalContractY}`, spot);
    });
    return map;
  }, [mapData]);

  // --- Max Village Count (for legend and color calculation) ---
  const maxVillageCountForRealms = useMemo(() => {
    if (realmStructuresData.length === 0) return 0;
    let max = 0;
    realmStructuresData.forEach(realmStructure => {
      const villages = realmStructure.original_structure_data?.['metadata.villages_count'] || 0;
      if (villages > max) {
        max = villages;
      }
    });
    return max > 0 ? max : 1; // Avoid division by zero, ensure at least 1 for ratio calculation if any villages exist
  }, [realmStructuresData]);
  // --- End Max Village Count ---

  // --- New: Final combined address to username map ---
  const finalAddressToUsernameMap = useMemo(() => {
    console.log("[liveMapPage] Creating finalAddressToUsernameMap...");
    const combinedMap = new Map<string, string>();

    // 1. Populate with Cartridge usernames
    cartridgeUsernames.forEach((username, address) => {
      // addresses from cartridgeUsernames should already be normalized by the API
      combinedMap.set(address, username);
    });

    // 2. Override with guild member usernames where available (these take precedence)
    guildMembers.forEach(member => {
      if (member.address && member.username) { // Only if guild member has a username
        const normalizedAddr = normalizeAddress(member.address);
        if (normalizedAddr) {
          combinedMap.set(normalizedAddr, member.username);
        }
      }
    });
    console.log("[liveMapPage] finalAddressToUsernameMap created with", combinedMap.size, "entries.");
    return combinedMap;
  }, [guildMembers, cartridgeUsernames]);
  // --- End Final Combined Map ---

  // ---- START playerToTribeMap (similar to EternumStructuresPage) ----
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

  // --- New: Memoized list of unique players for dropdown ---
  const uniquePlayersForDropdown = useMemo(() => {
    if (realmStructuresData.length === 0) return [];
    console.log("[liveMapPage] Creating uniquePlayersForDropdown...");

    const players = new Map<string, { address: string; name: string }>();

    realmStructuresData.forEach(realm => {
      if (realm.owner_address) {
        const normalizedAddr = normalizeAddress(realm.owner_address);
        if (normalizedAddr && !players.has(normalizedAddr)) {
          const displayName = finalAddressToUsernameMap.get(normalizedAddr) || `${normalizedAddr.substring(0,6)}...`;
          players.set(normalizedAddr, { address: normalizedAddr, name: displayName });
        }
      }
    });

    // Convert map to array and sort by name
    const sortedPlayers = Array.from(players.values()).sort((a, b) => {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    console.log(`[liveMapPage] uniquePlayersForDropdown created with ${sortedPlayers.length} players.`);
    return sortedPlayers;
  }, [realmStructuresData, finalAddressToUsernameMap]);
  // --- End Unique Players for Dropdown ---

  // New: Combine RealmStructureData with PotentialSpots for rendering occupied spots
  const occupiedSpotsRenderData = useMemo(() => {
    if (!mapData || realmStructuresData.length === 0) return [];

    // maxVillageCountForRealms is now used directly from the outer scope useMemo

    const renderData = [];
    for (const realmStructure of realmStructuresData) {
      const spotContractIdentifier = `${realmStructure.x}-${realmStructure.y}`;
      const potentialSpot = potentialSpotsMap.get(spotContractIdentifier);

      // Only include if it corresponds to a known potential spot
      if (potentialSpot) {
        const normalizedOwnerAddress = normalizeAddress(realmStructure.owner_address);
        let fillColor = DEFAULT_FILL_COLOR; // Start with default grey

        // Determine fill color based on the selected layer
        if (selectedLayer === 'guild') {
          // Guild layer: Use member color or default occupied color
          if (normalizedOwnerAddress && memberToColorMap.has(normalizedOwnerAddress)) {
            fillColor = memberToColorMap.get(normalizedOwnerAddress)!;
          } else {
            fillColor = OCCUPIED_FILL_COLOR; // Non-guild member occupied color
          }
        } else if (selectedLayer === 'tribe' && selectedTribeId) {
          // Tribe layer: Highlight if the owner is in the selected tribe
          const tribeInfo = playerToTribeMap.get(normalizedOwnerAddress || '');
          if (tribeInfo && tribeInfo.guildId === selectedTribeId) {
            fillColor = '#e67e22'; // Orange highlight for selected tribe
          } else {
            fillColor = DEFAULT_FILL_COLOR;
          }
        } else if (selectedLayer === 'resource' && selectedResourceHighlight) {
          // Resource layer: Check if the realm produces the highlighted resource
          const realmInfoFromResourcesApi = realmResourceMap.get(realmStructure.metadata_realm_id);
          let producesResource = false;
          if (realmInfoFromResourcesApi && realmInfoFromResourcesApi.resources) {
            if (typeof realmInfoFromResourcesApi.resources[0] === 'string') {
              producesResource = (realmInfoFromResourcesApi.resources as unknown as string[]).includes(selectedResourceHighlight);
            } else if (typeof realmInfoFromResourcesApi.resources[0] === 'object') {
              producesResource = (realmInfoFromResourcesApi.resources as ResourceDefinition[]).some(r => r.name === selectedResourceHighlight);
            }
          }

          if (producesResource) {
            fillColor = RESOURCE_HIGHLIGHT_COLOR; // Highlight color if resource is present
          } else {
            fillColor = DEFAULT_FILL_COLOR; // Default grey if not producing resource
          }
        } else if (selectedLayer === 'village') {
          // Village layer: Color by village density
          const villagesCount = realmStructure.original_structure_data?.['metadata.villages_count'] || 0;
          if (villagesCount >= 1) {
            fillColor = getVillageDensityColor(villagesCount, maxVillageCountForRealms);
          } else {
            fillColor = DEFAULT_FILL_COLOR; // Default for realms with no villages in this mode
          }
        } else if (selectedLayer === 'player') {
          // Player Search layer: Highlight if the realm is owned by the selected player
          if (normalizedOwnerAddress && selectedPlayerAddressHighlight && normalizedOwnerAddress === selectedPlayerAddressHighlight) {
            fillColor = RESOURCE_HIGHLIGHT_COLOR; // REUSED from resource search
          } else {
            fillColor = DEFAULT_FILL_COLOR;
          }
        } else {
          // Default case (should not happen with defined layers but good fallback)
          fillColor = DEFAULT_FILL_COLOR;
        }

        renderData.push({
          key: `occupied-${potentialSpot.layer}-${potentialSpot.point}-${realmStructure.x}-${realmStructure.y}`,
          normalizedX: potentialSpot.normalizedX,
          normalizedY: potentialSpot.normalizedY,
          fillColor: fillColor,
          isWonder: realmStructure.is_wonder, // Directly use the boolean
          // Include realmStructure and potentialSpot data for the click handler
          originalData: { ...potentialSpot, ...realmStructure } 
        });
      }
    }
    return renderData;
  }, [mapData, realmStructuresData, potentialSpotsMap, memberToColorMap, selectedLayer, selectedResourceHighlight, realmResourceMap, maxVillageCountForRealms, selectedPlayerAddressHighlight, selectedTribeId, playerToTribeMap]); // Added selectedPlayerAddressHighlight and selectedTribeId

  // MODIFIED: Member Legend now uses realmStructuresData
  const coloredMembersForLegend = useMemo(() => {
    if (realmStructuresData.length === 0 || guildMembers.length === 0) return [];
    const uniqueMembers = new Map<string, { name?: string; color: string; address: string }>();

    // Iterate over guildMembers to ensure only guild members are in the legend
    guildMembers.forEach(member => {
      if (member.address) {
        const normalizedAddr = normalizeAddress(member.address)!;
        if (memberToColorMap.has(normalizedAddr)) { // Check if this member has a color (is an owner of a realm)
          if (!uniqueMembers.has(normalizedAddr)) {
            // Get the most comprehensive username from the final map
            const displayName = finalAddressToUsernameMap.get(normalizedAddr) || member.username; // Fallback to member.username if somehow not in finalMap

            uniqueMembers.set(normalizedAddr, {
              address: normalizedAddr,
              name: displayName || undefined, 
              color: memberToColorMap.get(normalizedAddr)!
            });
          }
        }
      }
    });
    return Array.from(uniqueMembers.values()).sort((a,b) => (a.name || a.address).localeCompare(b.name || b.address));
  }, [realmStructuresData, guildMembers, memberToColorMap, finalAddressToUsernameMap]); // Updated dependencies

  // New function to encapsulate data fetching
  const fetchMapData = async () => {
    console.log("[liveMapPage] Fetching map data..."); // Log start of fetch
    setLoading(true);
    setLoadingMembers(true);
    setLoadingStructuresData(true); 
    setLoadingRealmResources(true); 
    setLoadingCartridgeUsernames(true); // Initialize loading for Cartridge usernames
    setLoadingTribes(true);
    setError(null); // Clear previous errors on new fetch

    let allOwnerAddresses: string[] = []; // To store addresses for Cartridge API call
    let currentMapData: MapData | null = null; // To hold map data for processing

    try {
      // Fetch map data, member data, RealmStructureData, RealmResources, and Tribe Data in parallel
      const [mapResponse, memberResponse, structuresResponse, realmResourceResponse, tribesResponse] = await Promise.all([
        fetch('/eternum_all_locations.json'),
        fetch('/api/members'),
        fetch('/api/eternum-structures'), // MODIFIED: Use the new API route
        fetch("/api/realms"), // Fetch realm resource data
        fetch("/api/tribes") // Fetch tribe data
      ]);

      // Process Map Data (comes first as structures might augment it)
      if (!mapResponse.ok) {
        throw new Error(`Failed to fetch map data: ${mapResponse.status} ${mapResponse.statusText}`);
      }
      const mapJsonData: MapData = await mapResponse.json();
      currentMapData = mapJsonData; // Store mapJsonData


      // Process Member Data
      if (!memberResponse.ok) {
        console.error('Failed to fetch guild members:', memberResponse.statusText);
        setGuildMembers([]); 
      } else {
        const membersJsonData: Member[] = await memberResponse.json();
        setGuildMembers(membersJsonData); 
      }

      // Process Structures Data
      if (!structuresResponse.ok) {
        console.error('Failed to fetch Structures Data:', structuresResponse.statusText);
        setRealmStructuresData([]); 
        setVillageStructuresData([]);
      } else {
        const structuresJson: GenericStructure[] = await structuresResponse.json();
        console.log(`[liveMapPage] Fetched ${structuresJson.length} structures.`);

        const loadedRealms: RealmStructureData[] = [];
        const loadedVillages: VillageStructureData[] = [];
        const bankStructureMapByCoords = new Map<string, GenericStructure>();
        const uniqueOwnerAddresses = new Set<string>(); // For Cartridge API

        structuresJson.forEach(struct => {
          if (struct['base.category'] === 1) { // Realm
            loadedRealms.push({
              entity_id: struct.entity_id,
              owner_address: struct.owner,
              is_wonder: struct['metadata.has_wonder'] === 1,
              x: struct['base.coord_x'],
              y: struct['base.coord_y'],
              metadata_realm_id: struct['metadata.realm_id'],
              original_structure_data: struct, // Store full structure
            });
          } else if (struct['base.category'] === 3) { // Bank
            bankStructureMapByCoords.set(`${struct['base.coord_x']}-${struct['base.coord_y']}`, struct);
          } else if (struct['base.category'] === 5) { // Village
            loadedVillages.push(struct as VillageStructureData); // Assuming direct cast is okay for now
          }
          if (struct.owner) uniqueOwnerAddresses.add(struct.owner); // Collect owner addresses from all structures
        });
        setRealmStructuresData(loadedRealms);
        setVillageStructuresData(loadedVillages);
        console.log(`[liveMapPage] Processed ${loadedRealms.length} realms, ${loadedVillages.length} villages, and ${bankStructureMapByCoords.size} bank structures.`);

        // Update bank owners and attach full structure data in currentMapData
        const updatedBanks = currentMapData.banks.map(bankSpot => {
          const foundBankStructure = bankStructureMapByCoords.get(`${bankSpot.originalContractX}-${bankSpot.originalContractY}`);
          if (foundBankStructure) {
            if (foundBankStructure.owner) uniqueOwnerAddresses.add(foundBankStructure.owner); // Add bank owner address
            return { 
              ...bankSpot, 
              ownerAddress: foundBankStructure.owner, 
              original_structure_data: foundBankStructure 
            };
          }
          return bankSpot;
        });
        currentMapData = { ...currentMapData, banks: updatedBanks };
        allOwnerAddresses = Array.from(uniqueOwnerAddresses); // Store collected addresses
      }
      
      // Now set the map data (potentially with updated banks)
      if (currentMapData) {
        setMapData(currentMapData);
      }


      // Process Realm Resource Data
      if (!realmResourceResponse.ok) {
        console.error('Failed to fetch Realm Resource Data:', realmResourceResponse.statusText);
        setRealmResourceData([]); 
      } else {
        const realmResourcesJsonData = await realmResourceResponse.json(); // Parse first
        // Add check: Ensure the parsed data is an array
        if (Array.isArray(realmResourcesJsonData)) {
          setRealmResourceData(realmResourcesJsonData as RealmResourceInfo[]); // Type assertion is safer now
          console.log(`[liveMapPage] Fetched ${realmResourcesJsonData.length} Realm Resource entries.`);
        } else {
          console.error('Realm Resource Data fetched is not an array:', realmResourcesJsonData);
          setRealmResourceData([]); // Default to empty array if not an array
        }
      }

      // ---- START PROCESS TRIBES DATA ----
      if (!tribesResponse.ok) {
        console.error('Failed to fetch tribes data:', tribesResponse.statusText);
        setProcessedGuilds(new Map()); // Set to empty map on error
      } else {
        const tribesJsonData: TribeMemberInfo[] = await tribesResponse.json();
        const guilds = new Map<string, ProcessedGuildInfo>();
        tribesJsonData.forEach(memberInfo => {
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
          // Ensure memberCount is the highest reported for the guild
          guild.memberCount = Math.max(guild.memberCount, memberInfo.member_count || 0); 
        });
        setProcessedGuilds(guilds);
        console.log(`[liveMapPage] Processed ${guilds.size} tribes/guilds.`);
      }
      // ---- END PROCESS TRIBES DATA ----

      // --- Fetch Cartridge Usernames for all collected owner addresses ---
      if (allOwnerAddresses.length > 0) {
        console.log(`[liveMapPage] Fetching Cartridge usernames for ${allOwnerAddresses.length} addresses...`);
        try {
          const cartridgeUsernamesResponse = await fetch('/api/cartridge-usernames', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ addresses: allOwnerAddresses }),
          });

          if (!cartridgeUsernamesResponse.ok) {
            const errorData = await cartridgeUsernamesResponse.text();
            console.error('[liveMapPage] Failed to fetch Cartridge usernames. Status:', cartridgeUsernamesResponse.status, 'Response:', errorData);
            setCartridgeUsernames(new Map());
          } else {
            const responseText = await cartridgeUsernamesResponse.text();
            try {
              const usernamesJson: CartridgeUsernamesResponse = JSON.parse(responseText);
              const newCartridgeUsernamesMap = new Map<string, string>();
              for (const address in usernamesJson) {
                newCartridgeUsernamesMap.set(address, usernamesJson[address]);
              }
              setCartridgeUsernames(newCartridgeUsernamesMap);
            } catch (parseError) {
              console.error("[liveMapPage] Failed to parse JSON response from /api/cartridge-usernames:", parseError, "Raw response was:", responseText);
              setCartridgeUsernames(new Map());
            }
          }
        } catch (cartridgeErr) {
          console.error("[liveMapPage] Error during fetch call to /api/cartridge-usernames:", cartridgeErr);
          setCartridgeUsernames(new Map());
        }
      } else {
        setCartridgeUsernames(new Map());
      }
      // --- End Cartridge Username Fetch ---

    } catch (err: unknown) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
      setLoadingMembers(false);
      setLoadingStructuresData(false); 
      setLoadingRealmResources(false); 
      setLoadingCartridgeUsernames(false); // Set loading to false for Cartridge usernames
      setLoadingTribes(false); // Set loading to false for tribes
      console.log("[liveMapPage] Finished fetching map data."); // Log end of fetch
    }
  };

  // Initial data fetch on component mount
  useEffect(() => {
    fetchMapData();
  }, []);

  // Calculate the base viewbox needed to contain all elements
  const baseViewBox = useMemo(() => {
    if (!mapData) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    const pointsToConsider: { normalizedX: number; normalizedY: number }[] = [];
    mapData.allPotentialSpots.forEach(s => pointsToConsider.push({normalizedX: s.normalizedX, normalizedY: s.normalizedY}));
    mapData.banks.forEach(b => pointsToConsider.push({normalizedX: b.normalizedX, normalizedY: b.normalizedY}));
    if (mapData.center) {
        pointsToConsider.push({normalizedX: mapData.center.x, normalizedY: mapData.center.y});
    }

    if (pointsToConsider.length === 0) return { x: 0, y: 0, width: 1000, height: 1000 }; // Default base

    pointsToConsider.forEach(spot => {
      // Include hexagon dimensions for bounds calculation
      minX = Math.min(minX, spot.normalizedX - HEX_SIZE);
      minY = Math.min(minY, spot.normalizedY - HEX_SIZE); 
      maxX = Math.max(maxX, spot.normalizedX + HEX_SIZE);
      maxY = Math.max(maxY, spot.normalizedY + HEX_SIZE);
    });

    const padding = HEX_SIZE * 10; // Base padding
    const width = Math.max(maxX - minX + padding * 2, HEX_SIZE * 40); // Ensure minimum width
    const height = Math.max(maxY - minY + padding * 2, HEX_SIZE * 40); // Ensure minimum height
    const x = minX - padding;
    const y = minY - padding;

    return { x, y, width, height };
  }, [mapData]);

  // Calculate the current viewBox string based on zoom level
  const currentViewBox = useMemo(() => {
    if (!baseViewBox) return '0 0 1000 1000'; // Default if base isn't calculated

    const { x: baseX, y: baseY, width: baseWidth, height: baseHeight } = baseViewBox;

    // Center of the base view
    const centerX = baseX + baseWidth / 2;
    const centerY = baseY + baseHeight / 2;

    // Calculate zoomed dimensions
    const zoomedWidth = baseWidth / zoomLevel;
    const zoomedHeight = baseHeight / zoomLevel;

    // Calculate the top-left corner, adjusting for both zoom and pan offset
    const currentMinX = centerX - zoomedWidth / 2 + viewBoxOffset.x;
    const currentMinY = centerY - zoomedHeight / 2 + viewBoxOffset.y;

    return `${currentMinX} ${currentMinY} ${zoomedWidth} ${zoomedHeight}`;
  }, [baseViewBox, zoomLevel, viewBoxOffset]);

  // Zoom Handlers
  const handleZoomIn = () => {
    setZoomLevel(prevZoom => Math.min(prevZoom * 1.2, 5)); // Zoom in, max 5x
  };

  const handleZoomOut = () => {
    setZoomLevel(prevZoom => Math.max(prevZoom / 1.2, 0.5)); // Zoom out, min 0.5x
  };

  // --- Panning Handlers wrapped in useCallback --- 
  const handlePanStart = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault(); // Prevent default drag behavior (like image saving)
    setIsDragging(true);
    const currentPos = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    setStartDragPos(currentPos);
    setInitialViewBoxOffset(viewBoxOffset); // Store the offset at the start of the drag
  };

  const handlePanMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !svgRef.current || !baseViewBox) return;
    e.preventDefault(); // Prevent scrolling during drag

    const currentPos = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    const dx = currentPos.x - startDragPos.x;
    const dy = currentPos.y - startDragPos.y;

    // Convert screen pixel difference to SVG coordinate difference
    const svgRect = svgRef.current.getBoundingClientRect();
    const { width: baseWidth, height: baseHeight } = baseViewBox; // Use base dimensions
    const zoomedWidth = baseWidth / zoomLevel;
    const zoomedHeight = baseHeight / zoomLevel;

    // Calculate scaling factor
    const scaleX = zoomedWidth / svgRect.width;
    const scaleY = zoomedHeight / svgRect.height;

    const svgDx = dx * scaleX;
    const svgDy = dy * scaleY;

    // Calculate new potential offset
    let newOffsetX = initialViewBoxOffset.x - svgDx;
    let newOffsetY = initialViewBoxOffset.y - svgDy;

    // --- Corrected Boundary Calculation ---
    const limitX = Math.max(0, (baseWidth - zoomedWidth) / 2); 
    const limitY = Math.max(0, (baseHeight - zoomedHeight) / 2);

    newOffsetX = Math.max(-limitX, Math.min(limitX, newOffsetX));
    newOffsetY = Math.max(-limitY, Math.min(limitY, newOffsetY));

    setViewBoxOffset({ x: newOffsetX, y: newOffsetY });
  }, [isDragging, svgRef, baseViewBox, startDragPos, zoomLevel, initialViewBoxOffset]); // Added dependencies

  const handlePanEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]); // Added dependency

  // Effect to add/remove window event listeners for panning
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('touchmove', handlePanMove, { passive: false }); // passive: false to allow preventDefault
      window.addEventListener('mouseup', handlePanEnd);
      window.addEventListener('touchend', handlePanEnd);
      window.addEventListener('mouseleave', handlePanEnd); // Stop drag if mouse leaves window
    }

    // Cleanup function
    return () => {
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('touchmove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
      window.removeEventListener('touchend', handlePanEnd);
      window.removeEventListener('mouseleave', handlePanEnd);
    };
  }, [isDragging, handlePanMove, handlePanEnd]); // Dependencies now stable

  // Function to reset pan and optionally zoom
  const handleCenterMap = () => {
    setViewBoxOffset({ x: 0, y: 0 });
    // Optionally reset zoom as well:
    // setZoomLevel(1);
  };

  // MODIFIED handleHexClick to work with new data structure from occupiedSpotsRenderData
  const handleHexClick = (hexData: HexSpot | RealmStructureData | MapCenter, type: string) => {
    if (isDragging) return;

    let currentRealmStructure: RealmStructureData | undefined = undefined;
    let currentPotentialSpotInfo: Partial<HexSpot> = {};
    let normalizedX: number, normalizedY: number;
    let contractX: number | undefined, contractY: number | undefined;
    let ownerAddressFromData: string | undefined;
    let ownerTribeInfo: { guildId: string, guildName: string } | undefined = undefined; // New variable for tribe info

    if (type === 'Occupied Spot') {
      // For Occupied Spot, hexData is a merged object of potentialSpot & realmStructure
      // from renderSpot.originalData. RealmStructureData fields are directly available.
      currentRealmStructure = hexData as RealmStructureData; 
      currentPotentialSpotInfo = hexData as HexSpot; // It also contains HexSpot fields like normalizedX/Y
      
      normalizedX = currentPotentialSpotInfo.normalizedX!;
      normalizedY = currentPotentialSpotInfo.normalizedY!;
      contractX = currentRealmStructure.x; 
      contractY = currentRealmStructure.y; 
      ownerAddressFromData = currentRealmStructure.owner_address;
      // ownerTribeInfo will be set later after normalizedOwnerAddress is defined

    } else if ('normalizedX' in hexData && 'normalizedY' in hexData) { // Potential Spot or Bank
      currentPotentialSpotInfo = hexData as HexSpot;
      normalizedX = currentPotentialSpotInfo.normalizedX ?? 0; // Provide fallback
      normalizedY = currentPotentialSpotInfo.normalizedY ?? 0; // Provide fallback
      contractX = currentPotentialSpotInfo.originalContractX;
      contractY = currentPotentialSpotInfo.originalContractY;
      ownerAddressFromData = currentPotentialSpotInfo.ownerAddress; // Banks now have this from structure data
      // For non-occupied, try to find realm structure if it exists (e.g., a wonder that is not occupied by a guild member)
      if (contractX !== undefined && contractY !== undefined) {
        currentRealmStructure = realmStructureMap.get(`${contractX}-${contractY}`);
      }
    } else { // Center Tile
      const centerData = hexData as MapCenter;
      normalizedX = centerData.x;
      normalizedY = centerData.y;
      // Center tile doesn't have originalContractX/Y in the same way
      // If we need to find SettleInfo for the center, we'd need its contract coords.
      // For now, assume center won't directly show SettleRealmInfo unless specifically mapped.
    }

    const normalizedOwnerAddress = normalizeAddress(ownerAddressFromData);

    // Now that normalizedOwnerAddress is defined, get tribe info if it's an occupied spot
    if (type === 'Occupied Spot' && normalizedOwnerAddress) {
      ownerTribeInfo = playerToTribeMap.get(normalizedOwnerAddress);
    }

    const realmStructureToUse = currentRealmStructure; 

    let displayOwnerName = '';
    // Get owner name from the final combined map
    if (normalizedOwnerAddress) {
        displayOwnerName = finalAddressToUsernameMap.get(normalizedOwnerAddress) || '';
    }
    // Fallback to potential spot's original ownerName if any (less likely now)
    if (!displayOwnerName && currentPotentialSpotInfo.ownerName) { 
         displayOwnerName = currentPotentialSpotInfo.ownerName;
    }
    // Final fallback to shortened address if no name found
    if (!displayOwnerName && normalizedOwnerAddress) {
        displayOwnerName = `${normalizedOwnerAddress.substring(0,6)}...${normalizedOwnerAddress.substring(normalizedOwnerAddress.length - 4)}`;
    } else if (!displayOwnerName) {
        displayOwnerName = '-'; // Default if no address either
    }

    // --- UPDATED: Look up realm by metadata_realm_id --- 
    const realmInfoFromMongo = realmStructureToUse ? realmResourceMap.get(realmStructureToUse.metadata_realm_id) : undefined;

    // The displayRealmName logic can now prioritize the name used for the successful lookup.
    const displayRealmName = realmInfoFromMongo ? realmInfoFromMongo.name : (realmStructureToUse ? `Realm ID: ${realmStructureToUse.metadata_realm_id}` : undefined);
    
    // Use metadata_realm_id for display, as it's the key for /api/realms
    const displayableRealmId = realmStructureToUse?.metadata_realm_id; 
    // --- END NAME LOOKUP --- 

    // --- Keep the resource extraction logic as it was based on the matched realmInfoFromMongo ---
    
    let finalResourcesToDisplay: ResourceDefinition[] | null = null; 
    if (realmInfoFromMongo && realmInfoFromMongo.resources) { 
      if (realmInfoFromMongo.resources.length > 0) { 
        let resourceDefinitions: ResourceDefinition[] = [];
        // Check the type of the first element to determine how to map
        if (typeof realmInfoFromMongo.resources[0] === 'string') {
          // Handle array of strings directly
          // Map strings to ResourceDefinitions to get rarity for styling
          resourceDefinitions = (realmInfoFromMongo.resources as unknown as string[])
            .map(name => getResourceDefinitionFromName(name))
            .filter((def): def is ResourceDefinition => def !== undefined); // Filter out undefineds
        } else if (typeof realmInfoFromMongo.resources[0] === 'object' && realmInfoFromMongo.resources[0] !== null && 'name' in realmInfoFromMongo.resources[0]) {
          // Handle array of ResourceDefinition objects
          resourceDefinitions = realmInfoFromMongo.resources as ResourceDefinition[]; // Use directly
        } else {
          console.warn("[liveMapPage][handleHexClick] Unknown structure for realmInfoFromMongo.resources element:", JSON.stringify(realmInfoFromMongo.resources[0], null, 2));
          // Keep resourceDefinitions as empty array
        }
        // UPDATED SORT: Sort by ID (ascending) then by name (ascending)
        finalResourcesToDisplay = resourceDefinitions.sort((a, b) => {
         if (a.id < b.id) return -1;
         if (a.id > b.id) return 1;
         return a.name.localeCompare(b.name); // Secondary sort by name if IDs are equal
        });
      } else { 
        finalResourcesToDisplay = []; // Set to empty array if none found
        console.log("[liveMapPage][handleHexClick] realmInfoFromMongo.resources is empty.");
      }
    } else if (realmInfoFromMongo) {
      console.warn("[liveMapPage][handleHexClick] realmInfoFromMongo exists, but realmInfoFromMongo.resources is missing or undefined:", JSON.stringify(realmInfoFromMongo, null, 2));
    } else if (realmStructureToUse) { // Only log if we expected to find something (i.e., it's a realm structure)
      console.log(`[liveMapPage][handleHexClick] realmInfoFromMongo is undefined for metadata_realm_id ${realmStructureToUse.metadata_realm_id}, cannot extract resources.`);
    }

    // --- New: Extract Guard Troops and Village Count for Occupied Spots ---
    let guardTroopsDisplay: string[] | null = null;
    let villagesDisplayCount: number | undefined = undefined;
    let structureToParseForTroops: GenericStructure | undefined = undefined;

    if (type === 'Occupied Spot' && realmStructureToUse && realmStructureToUse.original_structure_data) {
      const structData = realmStructureToUse.original_structure_data;
      villagesDisplayCount = structData['metadata.villages_count'];
      structureToParseForTroops = structData; // For realms
    } else if (type === 'Bank') {
      // Assuming hexData for a bank now contains original_structure_data from fetchMapData augmentation
      const bankHexSpot = hexData as HexSpot; // HexSpot already allows original_structure_data?: GenericStructure
      structureToParseForTroops = bankHexSpot.original_structure_data; // For banks
    }

    guardTroopsDisplay = parseTroopGuardsFromStructure(structureToParseForTroops);

    // --- End New Extraction ---

    const dataForState: SelectedHexData = {
      type: type,
      normalizedX: normalizedX,
      normalizedY: normalizedY,
      ...( contractX !== undefined && { originalContractX: contractX }),
      ...( contractY !== undefined && { originalContractY: contractY }),
      ...( currentPotentialSpotInfo.side !== undefined && { side: currentPotentialSpotInfo.side }),
      ...( currentPotentialSpotInfo.layer !== undefined && { layer: currentPotentialSpotInfo.layer }),
      ...( currentPotentialSpotInfo.point !== undefined && { point: currentPotentialSpotInfo.point }),
      ownerAddress: normalizedOwnerAddress, 
      ownerName: displayOwnerName || (normalizedOwnerAddress ? `${normalizedOwnerAddress.substring(0,6)}...` : '-'), // Fallback for owner name
      isWonder: realmStructureToUse ? realmStructureToUse.is_wonder : false, 
      // Restore realmId and displayRealmName assignment
      realmId: displayableRealmId, // Use metadata_realm_id for display
      realmName: displayRealmName || undefined,
      resourcesToDisplay: finalResourcesToDisplay, // Store the array of objects
      guardTroopsInfo: guardTroopsDisplay,
      villagesCount: villagesDisplayCount,
      // Add tribe info to the state
      tribeId: ownerTribeInfo?.guildId,
      tribeName: ownerTribeInfo?.guildName,
    };
    setSelectedHex(dataForState);
  };

  // --- New Helper Function to Parse Troop Guards from Structure Data ---
  function parseTroopGuardsFromStructure(structureData: GenericStructure | undefined): string[] | null {
    if (!structureData) return null;

    const troopCounts: { [key: string]: number } = {}; 
    let totalTroopCount = 0;

    for (const key in structureData) {
      if (key.startsWith('troop_guards.') && key.endsWith('.count')) {
        const parts = key.split('.'); 
        if (parts.length === 3) {
          const troopSlot = parts[1]; // 'alpha', 'bravo', etc.
          const category = structureData[`troop_guards.${troopSlot}.category`];
          const tier = structureData[`troop_guards.${troopSlot}.tier`];
          const countHex = structureData[key];
          
          if (category && tier && typeof countHex === 'string' && countHex.startsWith('0x')) {
            try {
              const count = parseInt(countHex, 16);
              if (!isNaN(count) && count > 0) {
                const troopKey = `${category}${tier}`;
                const adjustedCount = count / 1000000000; 
                if (adjustedCount > 0) { 
                  troopCounts[troopKey] = (troopCounts[troopKey] || 0) + adjustedCount;
                  totalTroopCount += adjustedCount;
                }
              }
            } catch (e) {
              console.warn(`Failed to parse troop count for ${key}: ${countHex}`, e);
            }
          }
        }
      }
    }

    if (totalTroopCount > 0) {
      return Object.entries(troopCounts)
                     .map(([type, num]) => `${num.toLocaleString()} ${type}`); // Returns array of strings
    }
    return null; // Return null if no troops
  }
  // --- End Troop Guard Parsing Function ---

  if (loading || loadingMembers || loadingStructuresData || loadingRealmResources || loadingCartridgeUsernames || loadingTribes) { // Update loading check
    return <div className="map-loading">Loading Map Data...</div>;
  }

  if (error) {
    return <div className="map-error">Error loading map: {error}</div>;
  }

  if (!mapData) {
    return <div className="map-no-data">No map data available.</div>;
  }

  return (
    <div className="live-map-root">
      <div className="map-container">
        {/* Control Panel Overlay - REMOVED */}
        {/* <div className="map-controls-overlay"> ... </div> */}
        
        {/* Zoom Controls (keep separate for now) */}
        <div className="zoom-controls">
          <button onClick={handleZoomIn} className="zoom-button">+</button>
          <button onClick={handleCenterMap} className="center-button">Center</button>
          <button onClick={handleZoomOut} className="zoom-button">-</button>
        </div>
        <div className="map-visualization-area">
          {/* Selected Hex Info Panel - now an overlay */}
          {selectedHex && (
            <div className="selected-hex-info-overlay">
              {/* Conditional Rendering based on type */}
              {selectedHex.type === 'Occupied Spot' ? (
                <>
                  <h3>{selectedHex.realmId || 'N/A'} : {selectedHex.realmName || 'Unnamed Realm'}</h3>
                  <div className="info-line">
                    <span className="info-label">Owner:</span>
                    <span className="info-value">{selectedHex.ownerName}</span>
                  </div>
                  {/* New: Display Tribe Name if available - MOVED HERE */}
                  {selectedHex.tribeName && (
                    <div className="info-line">
                      <span className="info-label">Tribe:</span>
                      <span className="info-value">{selectedHex.tribeName}</span>
                    </div>
                  )}
                  {selectedHex.villagesCount !== undefined && (
                    <div className="info-line">
                      <span className="info-label">Villages:</span>
                      <span className="info-value">{selectedHex.villagesCount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="info-line">
                    <span className="info-label">Coords:</span>
                    <span className="info-value">({selectedHex.normalizedX}, {selectedHex.normalizedY})</span>
                  </div>
                  {selectedHex.isWonder && (
                    <div className="info-line">
                      <span className="info-label">Status:</span>
                      <span className="info-value wonder-indicator">Wonder!</span>
                    </div>
                  )}
                  {/* New: Display Guard Troops and Village Count */}
                  {selectedHex.guardTroopsInfo && selectedHex.guardTroopsInfo.length > 0 && (
                     <div className="info-line guard-troops-line">
                       <span className="info-label">Guard Troops:</span>
                       <div className="info-value guard-troops-container">
                        {selectedHex.guardTroopsInfo.map((troopEntry, index) => (
                          <div key={`troop-${index}`} className="troop-entry">{troopEntry}</div>
                        ))}
                       </div>
                    </div>
                  )}
                  <div className="info-line resources-line">
                    <span className="info-label">Resources:</span> 
                    <div className="info-value resources-container">
                      {selectedHex.resourcesToDisplay && selectedHex.resourcesToDisplay.length > 0 ? (
                        selectedHex.resourcesToDisplay.map(res => (
                          <span 
                            key={res.id} 
                            className="resource-pair" 
                            data-rarity={res.rarity}
                          >
                            {res.name}
                          </span>
                        ))
                      ) : (
                        <span className="info-value-na">N/A</span>
                      )}
                    </div>
                  </div>
                </>
              ) : selectedHex.type === 'Bank' || selectedHex.type === 'Center' || selectedHex.type === 'Potential Spot' ? (
                <> 
                  {/* Default display for Bank, Center, Potential Spot */}
                  <h3>{selectedHex.type}</h3>
                  {selectedHex.side !== undefined && 
                    <div className="info-line">
                        <span className="info-label">Side, Layer, Point:</span>
                        <span className="info-value">({selectedHex.side}, {selectedHex.layer}, {selectedHex.point})</span>
                    </div>
                  }
                  {selectedHex.normalizedX !== undefined && 
                    <div className="info-line">
                        <span className="info-label">Normalized X, Y:</span>
                        <span className="info-value">({selectedHex.normalizedX}, {selectedHex.normalizedY})</span>
                    </div>
                  }
                  {/* Display Guard Troops for Banks if available */}
                  {selectedHex.type === 'Bank' && selectedHex.guardTroopsInfo && selectedHex.guardTroopsInfo.length > 0 && (
                    <div className="info-line guard-troops-line">
                       <span className="info-label">Guard Troops:</span>
                       <div className="info-value guard-troops-container">
                        {selectedHex.guardTroopsInfo.map((troopEntry, index) => (
                          <div key={`bank-troop-${index}`} className="troop-entry">{troopEntry}</div>
                        ))}
                       </div>
                    </div>
                  )}
                </>
              ) : (
                 // Default/fallback case if needed, or render nothing
                 <p>Details not available for this spot.</p>
              )}
              {/* Always show owner address if available for any type EXCEPT Occupied Spot */}
              {selectedHex.type !== 'Occupied Spot' && selectedHex.ownerAddress && 
                <div className="info-line">
                    <span className="info-label">Owner Address:</span>
                    <span className="info-value address-value">{selectedHex.ownerAddress}</span>
                </div>
              }
            </div>
          )}
          {!selectedHex && (
             <div className="selected-hex-info-overlay placeholder">
                <p>Click on a hexagon to see its details.</p>
             </div>
          )}

          <svg 
            viewBox={currentViewBox} 
            preserveAspectRatio="xMidYMid meet" 
            className={`hexagon-svg ${isDragging ? 'dragging' : ''}`}
            ref={svgRef}
            onMouseDown={handlePanStart}
            onTouchStart={handlePanStart}
          >
            <g>
              {/* Layer 1: Base potential spots (default color) - RESTORED */}
              {mapData.allPotentialSpots.map((spot) => {
                const spotKey = `potential-${spot.layer}-${spot.point}-${spot.originalContractX}-${spot.originalContractY}`;
                // For all layers, the base for all potential spots is now the "free" color.
                // Occupied spots will be repainted on top by the occupiedSpotsRenderData loop
                // with their respective highlight colors or appropriate default/occupied colors.
                const fillColor = FREE_POTENTIAL_SPOT_FILL_COLOR;

                const isSelected = selectedHex && spot.normalizedX === selectedHex.normalizedX && spot.normalizedY === selectedHex.normalizedY;

                return (
                  <HexagonTile
                    key={spotKey}
                    id={spotKey}
                    x={spot.normalizedX}
                    y={spot.normalizedY}
                    size={HEX_SIZE}
                    fillColor={fillColor}
                    strokeColor={STROKE_COLOR}
                    strokeWidth={HEX_STROKE_WIDTH}
                    onClick={() => handleHexClick(spot, 'Potential Spot')}
                    className={isSelected ? 'selected-hex-highlight' : ''}
                  />
                );
              })}

              {/* Layer 2: Occupied spots - Iterates over new occupiedSpotsRenderData */}
              {occupiedSpotsRenderData.map((renderSpot) => {
                  // Exclude banks and center tile if they happen to overlap (unlikely but safe)
                  const spotContractIdentifier = `${renderSpot.originalData.x}-${renderSpot.originalData.y}`;
                  if (bankSpotsSet.has(spotContractIdentifier)) return null; 
                  if (mapData.center && renderSpot.normalizedX === mapData.center.x && renderSpot.normalizedY === mapData.center.y && renderSpot.originalData.layer === 0 && renderSpot.originalData.point === 0) return null; // TODO: Check this layer/point logic for center with new data

                  const isSelected = selectedHex && renderSpot.normalizedX === selectedHex.normalizedX && renderSpot.normalizedY === selectedHex.normalizedY;
                  const wonderClass = renderSpot.isWonder ? 'wonder-pulse' : '';
                  const combinedClassName = `${wonderClass} ${isSelected ? 'selected-hex-highlight' : ''}`.trim();

                  return (
                    <HexagonTile
                      key={renderSpot.key}
                      id={renderSpot.key}
                      x={renderSpot.normalizedX} 
                      y={renderSpot.normalizedY}
                      size={HEX_SIZE}
                      fillColor={renderSpot.fillColor} 
                      strokeColor={STROKE_COLOR}    
                      strokeWidth={HEX_STROKE_WIDTH}
                      className={combinedClassName} // Apply wonder and selected class conditionally
                      onClick={() => {
                        // Pass the combined original data to the handler
                        handleHexClick(renderSpot.originalData, 'Occupied Spot');
                      }}
                    />
                  );
              })}
              
              {/* Layer 3: Banks (rendered separately and on top of potential/occupied) */}
              {mapData.banks.map((bank, index) => {
                 const bankKey = `bank-${index}-${bank.originalContractX}-${bank.originalContractY}`;
                 const isSelected = selectedHex && bank.normalizedX === selectedHex.normalizedX && bank.normalizedY === selectedHex.normalizedY;
                 const combinedClassName = `bank-tile ${isSelected ? 'selected-hex-highlight' : ''}`.trim();
                return (
                  <HexagonTile
                    key={bankKey}
                    id={`bank-${index}`}
                    x={bank.normalizedX}
                    y={bank.normalizedY}
                    size={HEX_SIZE * 1.05} // Slightly larger banks for emphasis
                    fillColor={BANK_FILL_COLOR}
                    strokeColor={BANK_STROKE_COLOR}
                    strokeWidth={SPECIAL_TILE_STROKE_WIDTH}
                    onClick={() => handleHexClick(bank, 'Bank')}
                    className={combinedClassName} // Add selected class conditionally
                  />
                );
              })}

              {/* Layer 4: Center Tile (rendered last to be on top of everything) */}
              {mapData.center && (
                (() => { // IIFE to calculate isSelected for center
                  const isSelected = selectedHex && mapData.center.x === selectedHex.normalizedX && mapData.center.y === selectedHex.normalizedY;
                  const combinedClassName = `center-tile ${isSelected ? 'selected-hex-highlight' : ''}`.trim();
                  return (
                    <HexagonTile
                      key="center-tile"
                      id="center-tile"
                      x={mapData.center.x} // Assumes these are normalized renderable coordinates
                      y={mapData.center.y}
                      size={HEX_SIZE * 1.15} // Slightly larger center tile
                      fillColor={CENTER_TILE_FILL_COLOR}
                      strokeColor={CENTER_TILE_STROKE_COLOR}
                      strokeWidth={SPECIAL_TILE_STROKE_WIDTH * 1.1}
                      onClick={() => handleHexClick(mapData.center, 'Center')}
                      className={combinedClassName} // Add selected class conditionally
                    />
                  );
                })()
              )}
            </g>
          </svg>
        </div>
      </div>

      {/* Combined Display Options + Legend Overlay */}
      <div className="map-display-options-overlay">
        {/* Layer Selection Controls */}
        <div className="control-section">
          {/* Layer Selection Radio Buttons */}
          <div className="control-group">
            <label className="control-label">Display Layer:</label>
            <div className="radio-group">
              <label>
                <input 
                  type="radio" 
                  name="layer" 
                  value="guild" 
                  checked={selectedLayer === 'guild'}
                  onChange={() => setSelectedLayer('guild')}
                /> Member Colors
              </label>
              <label>
                <input
                  type="radio"
                  name="layer"
                  value="tribe"
                  checked={selectedLayer === 'tribe'}
                  onChange={() => setSelectedLayer('tribe')}
                /> Tribe
              </label>
              <label>
                <input 
                  type="radio" 
                  name="layer" 
                  value="player" 
                  checked={selectedLayer === 'player'}
                  onChange={() => setSelectedLayer('player')}
                /> Player Search
              </label>
              <label>
                <input 
                  type="radio" 
                  name="layer" 
                  value="resource" 
                  checked={selectedLayer === 'resource'}
                  onChange={() => setSelectedLayer('resource')}
                /> Resource Search
              </label>
              <label>
                <input 
                  type="radio" 
                  name="layer" 
                  value="village" 
                  checked={selectedLayer === 'village'}
                  onChange={() => setSelectedLayer('village')}
                /> Village Density
              </label>
            </div>
          </div>

          {/* Resource Selection Dropdown (Conditional) */}
          {selectedLayer === 'resource' && (
            <div className="control-group">
              <label htmlFor="resourceSelect" className="control-label">Highlight Resource:</label>
              <select 
                id="resourceSelect"
                value={selectedResourceHighlight || ''}
                onChange={(e) => setSelectedResourceHighlight(e.target.value || null)}
                className="control-select"
              >
                <option value="">-- Select Resource --</option>
                {RESOURCE_DEFINITIONS
                  .filter(def => def.rarity !== 'troop') // Exclude troops
                  .filter(def => !EXCLUDED_RESOURCES.includes(def.name)) // Exclude based on the list from resources.ts
                  .sort((a, b) => a.id - b.id) // Sort by ID
                  .map(def => (
                    <option key={def.id} value={def.name}>{def.name}</option>
                  ))
                }
              </select>
            </div>
          )}

          {/* Player Selection Dropdown (Conditional) */}
          {selectedLayer === 'player' && (
            <div className="control-group">
              <label htmlFor="playerSelect" className="control-label">Highlight Player:</label>
              <select 
                id="playerSelect"
                value={selectedPlayerAddressHighlight || ''} // controlled component
                onChange={(e) => setSelectedPlayerAddressHighlight(e.target.value || null)}
                className="control-select"
              >
                <option value="">-- Select Player --</option>
                {uniquePlayersForDropdown.map(player => (
                  <option key={player.address} value={player.address}>
                    {player.name} ({player.address.substring(0,6)}...)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tribe Selection Dropdown (Conditional) */}
          {selectedLayer === 'tribe' && (
            <div className="control-group">
              <label htmlFor="tribeSelect" className="control-label">Highlight Tribe:</label>
              <select
                id="tribeSelect"
                value={selectedTribeId || ''}
                onChange={e => setSelectedTribeId(e.target.value || null)}
                className="control-select"
              >
                <option value="">-- Select Tribe --</option>
                {Array.from(processedGuilds.values())
                  .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                  .map(guild => (
                    <option key={guild.id} value={guild.id}>{guild.name} ({guild.memberCount})</option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Member Color Legend (Conditionally Rendered) */}
        {selectedLayer === 'guild' && coloredMembersForLegend.length > 0 && (
          <div className="legend-section">
            <h5 className="legend-title">Member Colors</h5>
            <ul>
              {coloredMembersForLegend.map(member => (
                <li key={member.address}>
                  <span 
                    className="legend-color-swatch"
                    style={{ backgroundColor: member.color }}
                  ></span>
                  {member.name || `${member.address.substring(0, 6)}...${member.address.substring(member.address.length - 4)}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tribe Legend (Conditionally Rendered) */}
        {selectedLayer === 'tribe' && selectedTribeId && processedGuilds.has(selectedTribeId) && (
          <div className="legend-section tribe-legend">
            <h5 className="legend-title">Tribe Info</h5>
            <div><b>Name:</b> {processedGuilds.get(selectedTribeId)?.name}</div>
            <div><b>Members:</b> {processedGuilds.get(selectedTribeId)?.memberCount}</div>
          </div>
        )}

        {/* Village Density Legend (Conditionally Rendered) */}
        {selectedLayer === 'village' && (
          <div className="legend-section village-density-legend">
            <h5 className="legend-title">Village Density (Count)</h5>
            <ul>
              {[1, 2, 3, 4, 5, 6].map(count => (
                <li key={`village-legend-${count}`}>
                  <span 
                    className="legend-color-swatch"
                    style={{ 
                      backgroundColor: getVillageDensityColor(count, maxVillageCountForRealms), 
                      border: getVillageDensityColor(count, maxVillageCountForRealms) === DEFAULT_FILL_COLOR ? '1px solid #555' : 'none' // Add border if it's default color
                    }}
                  ></span>
                  {count}
                </li>
              ))}
              {maxVillageCountForRealms > 6 && (
                 <li key="village-legend-more">
                  <span 
                    className="legend-color-swatch"
                    style={{ 
                        backgroundColor: getVillageDensityColor(maxVillageCountForRealms, maxVillageCountForRealms),
                        border: getVillageDensityColor(maxVillageCountForRealms, maxVillageCountForRealms) === DEFAULT_FILL_COLOR ? '1px solid #555' : 'none'
                    }}
                  ></span>
                  {`${maxVillageCountForRealms} (Max)`}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveMapPage; 