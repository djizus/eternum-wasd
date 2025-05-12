import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import './SettlingMapPage.css'; // We'll create this CSS file next
import HexagonTile from './HexagonTile'; // Import the new component

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
  ownerAddress?: string; // Added for occupied spots
  ownerName?: string;    // Added for occupied spots
  // Potentially other properties if they differ between banks, potential, or occupied spots
}

// REMOVED Zone Interface
// interface Zone {
//   zoneId: number;
//   name: string;
//   locations: HexSpot[]; // Updated to HexSpot[]
// }

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
  resourcesProduced?: string; // Store as a formatted string
}

interface MapData {
  maxLayers: number;
  center: MapCenter;
  banks: HexSpot[]; // Assuming banks also follow the HexSpot structure
  allPotentialSpots: HexSpot[]; // Keep for coordinate lookup
  // zones: Zone[]; // REMOVED
}

// --- New Type for SettleRealmData ---
interface SettleRealmInfo {
  cities: number;
  entity_id: number;
  event_id: string;
  harbors: number;
  id: number;
  owner_address: string; // Already exists in HexSpot but good to have here too
  owner_name: string; // Hex encoded
  realm_name: string; // Hex encoded
  regions: number;
  rivers: number;
  timestamp: string; // Hex encoded timestamp
  wonder: number; // 1 = not a wonder, other values = wonder
  x: number; // Corresponds to originalContractX
  y: number; // Corresponds to originalContractY
  // Include other fields if needed, e.g., internal_*
}
// --- End New Type ---

// --- Updated Type for Realm Resource Data (from /api/realms) ---
interface RealmAttribute {
  trait_type: string;
  value: string | number;
}

interface RealmResourceInfo {
  id: number; // Realm ID
  name: string; // Realm Name from MongoDB
  attributes: RealmAttribute[]; // Attributes array containing resources
  // Add other fields from /api/realms if needed later
}
// --- End Updated Type ---

const HEX_SIZE = 4; // Reduced from 10 to 4, further adjustment may be needed
const DEFAULT_FILL_COLOR = '#44475a'; // A slightly lighter dark grey
const OCCUPIED_FILL_COLOR = '#8B0000'; // Darker Red (Maroon/DarkRed)
const BANK_FILL_COLOR = '#f8f9fa';    // Very light grey / off-white for Banks
const BANK_STROKE_COLOR = '#34d399';  // A brighter green stroke for Banks
const CENTER_TILE_FILL_COLOR = '#e9ecef'; // Slightly different light grey for Center
const CENTER_TILE_STROKE_COLOR = '#fab005'; // A gold/yellow stroke for Center
const STROKE_COLOR = '#212529'; // Darker base stroke
const HEX_STROKE_WIDTH = 0.15; // Even thinner for less visual clutter with bright zones
const SPECIAL_TILE_STROKE_WIDTH = 0.4;

// Placeholder for member addresses - replace with actual normalized addresses

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

// --- New Hex to String Utility ---
function hexToString(hex: string | undefined): string {
  if (!hex || !hex.startsWith('0x') || hex === '0x0') {
    return ''; // Return empty for undefined, non-hex, or zero hex
  }
  try {
    const strippedHex = hex.substring(2);
    let result = '';
    for (let i = 0; i < strippedHex.length; i += 2) {
      const byte = parseInt(strippedHex.substring(i, i + 2), 16);
      if (byte > 0) { // Ignore null bytes
        result += String.fromCharCode(byte);
      }
    }
    return result;
  } catch (e) {
    console.error(`Failed to convert hex to string: ${hex}`, e);
    return ''; // Return empty on error
  }
}
// --- End New Utility ---

// Define Member interface based on findings in other components
interface Member {
  _id?: string;
  address?: string;
  username?: string;
}

const SettlingMapPage: React.FC = () => {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHex, setSelectedHex] = useState<SelectedHexData | null>(null); 
  const [guildMembers, setGuildMembers] = useState<Member[]>([]); // Store full Member objects
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true); 
  const [zoomLevel, setZoomLevel] = useState<number>(1); // Add zoom state
  // Add state for panning
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [startDragPos, setStartDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewBoxOffset, setViewBoxOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialViewBoxOffset, setInitialViewBoxOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Add state for SettleRealmData
  const [settleRealmData, setSettleRealmData] = useState<SettleRealmInfo[]>([]);
  const [loadingSettleRealmData, setLoadingSettleRealmData] = useState<boolean>(true);
  // Add state for Realm Resource data
  const [realmResourceData, setRealmResourceData] = useState<RealmResourceInfo[]>([]);
  const [loadingRealmResources, setLoadingRealmResources] = useState<boolean>(true);

  // Ref for the SVG element
  const svgRef = useRef<SVGSVGElement>(null);

  // REMOVED hexToZoneMap
  // const hexToZoneMap = useMemo(() => { ... });

  const bankSpotsSet = useMemo(() => {
    if (!mapData) return new Set<string>();
    const set = new Set<string>();
    mapData.banks.forEach(bank => set.add(`${bank.originalContractX}-${bank.originalContractY}`));
    return set;
  }, [mapData]);

  // New: Map from normalized member address to username
  const memberAddressToUsernameMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    guildMembers.forEach(member => {
      if (member.address) {
        map.set(normalizeAddress(member.address)!, member.username);
      }
    });
    return map;
  }, [guildMembers]);

  const memberToColorMap = useMemo(() => {
    const map = new Map<string, string>();
    guildMembers.forEach((member, index) => { // Iterate over guildMembers
      if (member.address) {
        map.set(normalizeAddress(member.address)!, MEMBER_COLORS[index % MEMBER_COLORS.length]);
      }
    });
    return map;
  }, [guildMembers]); 

  // New: Map for SettleRealmData lookup
  const settleRealmMap = useMemo(() => {
    const map = new Map<string, SettleRealmInfo>();
    settleRealmData.forEach(info => {
      // Use the x and y from SettleRealmInfo as the key
      map.set(`${info.x}-${info.y}`, info);
    });
    return map;
  }, [settleRealmData]);

  // New: Map for Realm Resource lookup (Realm ID -> Full RealmResourceInfo)
  const realmResourceMap = useMemo(() => {
    const map = new Map<number, RealmResourceInfo>(); // Store the whole object
    realmResourceData.forEach(realm => {
      map.set(realm.id, realm); // Use realm.id as key, store the realm object
    });
    return map;
  }, [realmResourceData]);

  // New: Create a lookup map for potential spots based on original contract coords
  const potentialSpotsMap = useMemo(() => {
    if (!mapData) return new Map<string, HexSpot>();
    const map = new Map<string, HexSpot>();
    mapData.allPotentialSpots.forEach(spot => {
      map.set(`${spot.originalContractX}-${spot.originalContractY}`, spot);
    });
    return map;
  }, [mapData]);

  // New: Combine SettleRealmData with PotentialSpots for rendering occupied spots
  const occupiedSpotsRenderData = useMemo(() => {
    if (!mapData || settleRealmData.length === 0) return [];

    const renderData = [];
    for (const settleInfo of settleRealmData) {
      const spotContractIdentifier = `${settleInfo.x}-${settleInfo.y}`;
      const potentialSpot = potentialSpotsMap.get(spotContractIdentifier);

      // Only include if it corresponds to a known potential spot
      if (potentialSpot) {
        const normalizedOwnerAddress = normalizeAddress(settleInfo.owner_address);
        let fillColor = OCCUPIED_FILL_COLOR; // Default for occupied
        if (normalizedOwnerAddress && memberToColorMap.has(normalizedOwnerAddress)) {
          fillColor = memberToColorMap.get(normalizedOwnerAddress)!;
        }
        const isWonder = settleInfo.wonder !== 1;

        renderData.push({
          key: `occupied-${potentialSpot.layer}-${potentialSpot.point}-${settleInfo.x}-${settleInfo.y}`,
          normalizedX: potentialSpot.normalizedX,
          normalizedY: potentialSpot.normalizedY,
          fillColor: fillColor,
          isWonder: isWonder,
          // Include settleInfo and potentialSpot data for the click handler
          originalData: { ...potentialSpot, ...settleInfo } 
        });
      }
    }
    return renderData;
  }, [mapData, settleRealmData, potentialSpotsMap, memberToColorMap]); // Dependencies

  // MODIFIED: Member Legend now uses settleRealmData
  const coloredMembersForLegend = useMemo(() => {
    if (settleRealmData.length === 0 || guildMembers.length === 0) return [];
    console.log("[SettlingMapPage] Recomputing coloredMembersForLegend. Current memberToColorMap keys:", Array.from(memberToColorMap.keys())); 
    const uniqueMembers = new Map<string, { name?: string; color: string; address: string }>();

    settleRealmData.forEach(settleInfo => { // Iterate over settleRealmData
      if (settleInfo.owner_address) {
        const normalizedAddr = normalizeAddress(settleInfo.owner_address)!;
        const ownerNameFromHex = hexToString(settleInfo.owner_name); // Convert hex name

        // Log check for specific name/address if needed (example below)
        // if (ownerNameFromHex && ownerNameFromHex.toLowerCase().includes('adventurer')) {
        //   console.log("[SettlingMapPage] Legend Check for 'adventurer':", {
        //     rawAddress: settleInfo.owner_address,
        //     normalizedAddress: normalizedAddr,
        //     ownerName: ownerNameFromHex,
        //     isInMemberToColorMap: memberToColorMap.has(normalizedAddr),
        //     colorFromMap: memberToColorMap.get(normalizedAddr)
        //   });
        // }

        if (memberToColorMap.has(normalizedAddr)) { 
          if (!uniqueMembers.has(normalizedAddr)) {
            const memberUsername = memberAddressToUsernameMap.get(normalizedAddr);
            uniqueMembers.set(normalizedAddr, {
              address: normalizedAddr,
              // Prioritize API username, fallback to converted hex name
              name: memberUsername || ownerNameFromHex || undefined, 
              color: memberToColorMap.get(normalizedAddr)!
            });
          }
        }
      }
    });
    return Array.from(uniqueMembers.values()).sort((a,b) => (a.name || a.address).localeCompare(b.name || b.address));
  }, [settleRealmData, guildMembers, memberToColorMap, memberAddressToUsernameMap]); // Updated dependencies

  // New function to encapsulate data fetching
  const fetchMapData = async () => {
    console.log("[SettlingMapPage] Fetching map data..."); // Log start of fetch
    setLoading(true);
    setLoadingMembers(true);
    setLoadingSettleRealmData(true); 
    setLoadingRealmResources(true); 
    setError(null); // Clear previous errors on new fetch

    try {
      // Fetch map data, member data, SettleRealmData, and RealmResources in parallel
      const [mapResponse, memberResponse, settleRealmResponse, realmResourceResponse] = await Promise.all([
        fetch('/eternum_all_locations.json'),
        fetch('/api/members'),
        fetch(`${process.env.NEXT_PUBLIC_GAME_DATA_SQL}?query=select+*+%0Afrom+%22s1_eternum-SettleRealmData%22`),
        fetch("/api/realms") // Fetch realm resource data
      ]);

      // Process Map Data
      if (!mapResponse.ok) {
        throw new Error(`Failed to fetch map data: ${mapResponse.status} ${mapResponse.statusText}`);
      }
      const mapJsonData: MapData = await mapResponse.json();
      setMapData(mapJsonData);

      // Process Member Data
      if (!memberResponse.ok) {
        console.error('Failed to fetch guild members:', memberResponse.statusText);
        setGuildMembers([]); 
      } else {
        const membersJsonData: Member[] = await memberResponse.json();
        setGuildMembers(membersJsonData); 
      }

      // Process SettleRealmData
      if (!settleRealmResponse.ok) {
        console.error('Failed to fetch SettleRealmData:', settleRealmResponse.statusText);
        setSettleRealmData([]); // Set empty on error
      } else {
        const settleRealmJsonData: SettleRealmInfo[] = await settleRealmResponse.json();
        setSettleRealmData(settleRealmJsonData);
        console.log(`[SettlingMapPage] Fetched ${settleRealmJsonData.length} SettleRealmData entries.`);
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
          console.log(`[SettlingMapPage] Fetched ${realmResourcesJsonData.length} Realm Resource entries.`);
        } else {
          console.error('Realm Resource Data fetched is not an array:', realmResourcesJsonData);
          setRealmResourceData([]); // Default to empty array if not an array
        }
      }

    } catch (err: unknown) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
      setLoadingMembers(false);
      setLoadingSettleRealmData(false); 
      setLoadingRealmResources(false); 
      console.log("[SettlingMapPage] Finished fetching map data."); // Log end of fetch
    }
  };

  // Initial data fetch on component mount
  useEffect(() => {
    fetchMapData();
  }, []);

  // Set up interval for refreshing data every 5 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log("[SettlingMapPage] Refreshing map data via interval...");
      fetchMapData(); // Call the fetch function
    }, 300000); // 5 minutes in milliseconds (5 * 60 * 1000)

    // Cleanup function to clear the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array ensures this effect runs only once on mount

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
  const handleHexClick = (hexData: HexSpot | SettleRealmInfo | MapCenter, type: string) => {
    if (isDragging) return;
    console.log("--- handleHexClick Start ---");
    console.log("Clicked hexData:", hexData);
    console.log("Clicked type:", type);

    let currentSettleInfo: SettleRealmInfo | undefined = undefined;
    let currentPotentialSpotInfo: Partial<HexSpot> = {};
    let normalizedX: number, normalizedY: number;
    let contractX: number | undefined, contractY: number | undefined;
    let ownerAddressFromData: string | undefined;

    if (type === 'Occupied Spot') {
      // For Occupied Spot, hexData is a merged object of potentialSpot & settleInfo
      // from renderSpot.originalData. SettleRealmInfo fields (x, y, owner_address etc.) are directly available.
      currentSettleInfo = hexData as SettleRealmInfo; // It contains all SettleRealmInfo fields
      currentPotentialSpotInfo = hexData as HexSpot; // It also contains HexSpot fields like normalizedX/Y
      
      normalizedX = currentPotentialSpotInfo.normalizedX!;
      normalizedY = currentPotentialSpotInfo.normalizedY!;
      contractX = currentSettleInfo.x; // from SettleRealmInfo
      contractY = currentSettleInfo.y; // from SettleRealmInfo
      ownerAddressFromData = currentSettleInfo.owner_address;

    } else if ('normalizedX' in hexData && 'normalizedY' in hexData) { // Potential Spot or Bank
      currentPotentialSpotInfo = hexData as HexSpot;
      normalizedX = currentPotentialSpotInfo.normalizedX ?? 0; // Provide fallback
      normalizedY = currentPotentialSpotInfo.normalizedY ?? 0; // Provide fallback
      contractX = currentPotentialSpotInfo.originalContractX;
      contractY = currentPotentialSpotInfo.originalContractY;
      ownerAddressFromData = currentPotentialSpotInfo.ownerAddress; // Banks/etc might have this if ever assigned
      // For non-occupied, try to find settleInfo if it exists (e.g., a wonder that is not occupied by a guild member)
      if (contractX !== undefined && contractY !== undefined) {
        currentSettleInfo = settleRealmMap.get(`${contractX}-${contractY}`);
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
    console.log("Contract Coords Key for Settle/Realm lookup:", contractX !== undefined && contractY !== undefined ? `${contractX}-${contractY}` : "N/A");

    // Use currentSettleInfo if already identified (especially for Occupied Spots)
    const settleInfoToUse = currentSettleInfo; 
    console.log("SettleInfo for display logic:", settleInfoToUse);

    let displayOwnerName = '';
    if (settleInfoToUse && settleInfoToUse.owner_name) {
      const convertedName = hexToString(settleInfoToUse.owner_name);
      if (convertedName) displayOwnerName = convertedName;
    } 
    if (!displayOwnerName && normalizedOwnerAddress) {
        displayOwnerName = memberAddressToUsernameMap.get(normalizedOwnerAddress) || '';
    }
    if (!displayOwnerName && currentPotentialSpotInfo.ownerName) { // Fallback to potential spot's original ownerName (e.g. from banks)
         displayOwnerName = currentPotentialSpotInfo.ownerName;
    }

    const realmId = settleInfoToUse?.entity_id;
    console.log("Extracted Realm ID (from entity_id):", realmId);

    const realmInfoFromMongo = realmId ? realmResourceMap.get(realmId) : undefined;
    console.log("RealmInfo from realmResourceMap:", realmInfoFromMongo);

    let displayRealmName = settleInfoToUse ? hexToString(settleInfoToUse.realm_name) : undefined;
    if (!displayRealmName && realmInfoFromMongo) {
      displayRealmName = realmInfoFromMongo.name;
    }

    let resourcesProducedString = 'N/A';
    if (realmInfoFromMongo && realmInfoFromMongo.attributes) {
      const resourceAttributes = realmInfoFromMongo.attributes.filter(attr => attr.trait_type === 'Resource');
      if (resourceAttributes.length > 0) {
        resourcesProducedString = resourceAttributes.map(attr => String(attr.value)).sort().join(', ');
      } else {
        resourcesProducedString = 'None';
      }
    }

    console.log("Determined Realm Name:", displayRealmName);
    console.log("Determined Resources String:", resourcesProducedString);

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
      ownerName: displayOwnerName || '-',
      isWonder: settleInfoToUse ? settleInfoToUse.wonder !== 1 : false, 
      realmId: realmId, 
      realmName: displayRealmName || undefined,
      resourcesProduced: resourcesProducedString
    };
    setSelectedHex(dataForState);
    console.log("--- handleHexClick End ---");
  };

  if (loading || loadingMembers || loadingSettleRealmData || loadingRealmResources) { // Update loading check
    return <div className="map-loading">Loading Map Data...</div>;
  }

  if (error) {
    return <div className="map-error">Error loading map: {error}</div>;
  }

  if (!mapData) {
    return <div className="map-no-data">No map data available.</div>;
  }

  return (
    <div className="settling-map-root">
      <div className="map-container">
        {/* Add Zoom Controls */} 
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
                  <p>Owner: {selectedHex.ownerName}</p>
                  {selectedHex.isWonder && <p className="wonder-indicator">Status: Wonder!</p>}
                  <p>Coords: ({selectedHex.normalizedX}, {selectedHex.normalizedY})</p>
                  <p>Resources: {selectedHex.resourcesProduced || 'N/A'}</p>
                </>
              ) : selectedHex.type === 'Bank' || selectedHex.type === 'Center' || selectedHex.type === 'Potential Spot' ? (
                <> 
                  {/* Default display for Bank, Center, Potential Spot */}
                  <h3>{selectedHex.type}</h3>
                  {selectedHex.side !== undefined && <p>Side, Layer, Point : ({selectedHex.side}, {selectedHex.layer}, {selectedHex.point})</p>}
                  {selectedHex.normalizedX !== undefined && <p>Normalized X, Y : ({selectedHex.normalizedX}, {selectedHex.normalizedY})</p>}
                </>
              ) : (
                 // Default/fallback case if needed, or render nothing
                 <p>Details not available for this spot.</p>
              )}
              {/* Always show owner address if available for any type EXCEPT Occupied Spot */}
              {selectedHex.type !== 'Occupied Spot' && selectedHex.ownerAddress && <p>Owner Address: {selectedHex.ownerAddress}</p>}
            </div>
          )}
          {!selectedHex && (
             <div className="selected-hex-info-overlay placeholder">
                <p>Click on a hexagon to see its details.</p>
             </div>
          )}

          {/* Member Color Legend */}
          {coloredMembersForLegend.length > 0 && (
            <div className="member-legend-overlay">
              <h4>Member Colors</h4>
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
                const fillColor = DEFAULT_FILL_COLOR; // Use default for all potential spots

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
                  />
                );
              })}

              {/* Layer 2: Occupied spots - Iterates over new occupiedSpotsRenderData */}
              {occupiedSpotsRenderData.map((renderSpot) => {
                  // Exclude banks and center tile if they happen to overlap (unlikely but safe)
                  const spotContractIdentifier = `${renderSpot.originalData.x}-${renderSpot.originalData.y}`;
                  if (bankSpotsSet.has(spotContractIdentifier)) return null; 
                  if (mapData.center && renderSpot.normalizedX === mapData.center.x && renderSpot.normalizedY === mapData.center.y && renderSpot.originalData.layer === 0 && renderSpot.originalData.point === 0) return null;

                  const wonderClass = renderSpot.isWonder ? 'wonder-pulse' : '';

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
                      className={wonderClass} // Apply wonder class conditionally
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
                    className='bank-tile' // For specific CSS if needed
                  />
                );
              })}

              {/* Layer 4: Center Tile (rendered last to be on top of everything) */}
              {mapData.center && (
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
                  className='center-tile' // For specific CSS if needed
                />
              )}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default SettlingMapPage; 