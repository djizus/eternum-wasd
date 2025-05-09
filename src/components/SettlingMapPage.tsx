import React, { useEffect, useState, useMemo } from 'react';
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

interface Zone {
  zoneId: number;
  name: string;
  locations: HexSpot[]; // Updated to HexSpot[]
}

// Combined type for selected hex data to include a 'type' and all possible fields
interface SelectedHexData extends Partial<HexSpot> { // Most fields from HexSpot are optional
  type: string;
  normalizedX: number; // Ensure these are present
  normalizedY: number;
  ownerAddress?: string; // Added
  ownerName?: string;    // Added
  // MapCenter specific fields are already covered by Partial<HexSpot> or are x/y renamed
  x?: number; // from MapCenter, will be mapped to normalizedX
  y?: number; // from MapCenter, will be mapped to normalizedY
}

interface MapData {
  maxLayers: number;
  center: MapCenter;
  banks: HexSpot[]; // Assuming banks also follow the HexSpot structure
  allPotentialSpots: HexSpot[];
  occupiedContractSpots: HexSpot[]; // Updated from object to array
  zones: Zone[];
}

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
const MEMBER_ADDRESSES: string[] = [
  "0x1234567890abcdef1234567890abcdef12345678", // Example Member 1
  "0xabcdef1234567890abcdef1234567890abcdef12", // Example Member 2
  "0xfedcba0987654321fedcba0987654321fedcba09"  // Example Member 3
  // Add more member addresses here
];

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

const normalizeAddress = (address: string | undefined): string | undefined => {
  if (!address) return undefined;
  if (address.toLowerCase().startsWith('0x0')) {
    return '0x' + address.substring(3);
  }
  return address.toLowerCase(); // Also ensure lowercase for consistent matching
};

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

  // REINSTATED hexToZoneMap
  const hexToZoneMap = useMemo(() => {
    if (!mapData) return new Map<string, { zoneId: number; zoneName: string }>();
    const map = new Map<string, { zoneId: number; zoneName: string }>();
    mapData.zones.forEach(zone => {
      zone.locations.forEach(loc => {
        map.set(`${loc.originalContractX}-${loc.originalContractY}`, { zoneId: zone.zoneId, zoneName: zone.name });
      });
    });
    return map;
  }, [mapData]);

  const bankSpotsSet = useMemo(() => {
    if (!mapData) return new Set<string>();
    const set = new Set<string>();
    mapData.banks.forEach(bank => set.add(`${bank.originalContractX}-${bank.originalContractY}`));
    return set;
  }, [mapData]);

  const occupiedSpotsSet = useMemo(() => {
    if (!mapData || !mapData.occupiedContractSpots) return new Set<string>();
    const set = new Set<string>();
    mapData.occupiedContractSpots.forEach(spot => set.add(`${spot.originalContractX}-${spot.originalContractY}`));
    return set;
  }, [mapData]);

  const occupiedSpotsMap = useMemo(() => {
    if (!mapData || !mapData.occupiedContractSpots) return new Map<string, HexSpot>();
    const map = new Map<string, HexSpot>();
    mapData.occupiedContractSpots.forEach(spot => {
      map.set(`${spot.originalContractX}-${spot.originalContractY}`, spot);
    });
    return map;
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

  // New: Memoized list for Member Legend
  const coloredMembersForLegend = useMemo(() => {
    if (!mapData || !mapData.occupiedContractSpots || guildMembers.length === 0) return [];
    console.log("[SettlingMapPage] Recomputing coloredMembersForLegend. Current memberToColorMap keys:", Array.from(memberToColorMap.keys())); 
    const uniqueMembers = new Map<string, { name?: string; color: string; address: string }>();

    mapData.occupiedContractSpots.forEach(spot => {
      if (spot.ownerAddress) {
        const normalizedAddr = normalizeAddress(spot.ownerAddress)!;
        
        if (spot.ownerName && spot.ownerName.toLowerCase().includes('adventurer')) {
          console.log("[SettlingMapPage] Legend Check for 'adventurer':", {
            rawAddress: spot.ownerAddress,
            normalizedAddress: normalizedAddr,
            ownerName: spot.ownerName,
            isInMemberToColorMap: memberToColorMap.has(normalizedAddr),
            colorFromMap: memberToColorMap.get(normalizedAddr)
          }); // LOG 2b
        }

        if (memberToColorMap.has(normalizedAddr)) { 
          if (!uniqueMembers.has(normalizedAddr)) {
            const memberUsername = memberAddressToUsernameMap.get(normalizedAddr);
            uniqueMembers.set(normalizedAddr, {
              address: normalizedAddr,
              name: memberUsername || spot.ownerName, // Prioritize API username
              color: memberToColorMap.get(normalizedAddr)!
            });
          }
        }
      }
    });
    return Array.from(uniqueMembers.values()).sort((a,b) => (a.name || a.address).localeCompare(b.name || b.address));
  }, [mapData, guildMembers, memberToColorMap, memberAddressToUsernameMap]); 

  useEffect(() => {
    const fetchMapAndMemberData = async () => {
      setLoading(true);
      setLoadingMembers(true);
      try {
        // Fetch map data
        const mapResponse = await fetch('/eternum_settlement_map_data.json');
        if (!mapResponse.ok) {
          throw new Error(`Failed to fetch map data: ${mapResponse.status} ${mapResponse.statusText}`);
        }
        const mapJsonData: MapData = await mapResponse.json();
        setMapData(mapJsonData);

        // Fetch member data
        const memberResponse = await fetch('/api/members');
        if (!memberResponse.ok) {
          console.error('Failed to fetch guild members:', memberResponse.statusText);
          setGuildMembers([]); 
        } else {
          const membersJsonData: Member[] = await memberResponse.json();
          setGuildMembers(membersJsonData); // Store full member objects
          console.log("[SettlingMapPage] Fetched guildMembers:", membersJsonData); // Updated LOG 1
        }

      } catch (err: unknown) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
        setLoadingMembers(false);
      }
    };

    fetchMapAndMemberData();
  }, []);

  const viewBox = useMemo(() => {
    if (!mapData) return '0 0 1000 1000';
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    const pointsToConsider: { normalizedX: number; normalizedY: number }[] = [];
    mapData.allPotentialSpots.forEach(s => pointsToConsider.push({normalizedX: s.normalizedX, normalizedY: s.normalizedY}));
    mapData.banks.forEach(b => pointsToConsider.push({normalizedX: b.normalizedX, normalizedY: b.normalizedY}));
    if (mapData.center) { // Assuming mapData.center.x and .y are normalized coords
        pointsToConsider.push({normalizedX: mapData.center.x, normalizedY: mapData.center.y});
    }

    if (pointsToConsider.length === 0) return '0 0 1000 1000';

    pointsToConsider.forEach(spot => {
      minX = Math.min(minX, spot.normalizedX - HEX_SIZE);
      minY = Math.min(minY, spot.normalizedY - HEX_SIZE);
      maxX = Math.max(maxX, spot.normalizedX + HEX_SIZE);
      maxY = Math.max(maxY, spot.normalizedY + HEX_SIZE);
    });
    const padding = HEX_SIZE * 10; // Generous padding
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const finalWidth = Math.max(width, HEX_SIZE * 40);
    const finalHeight = Math.max(height, HEX_SIZE * 40);
    return `${minX - padding} ${minY - padding} ${finalWidth} ${finalHeight}`;
  }, [mapData]);

  const handleHexClick = (hexData: HexSpot | MapCenter, type: string) => {
    const normalizedOwnerAddress = 'ownerAddress' in hexData ? normalizeAddress(hexData.ownerAddress) : undefined;

    const dataForState: SelectedHexData = {
      type: type,
      normalizedX: 'normalizedX' in hexData ? hexData.normalizedX : hexData.x,
      normalizedY: 'normalizedY' in hexData ? hexData.normalizedY : hexData.y,
      ...( 'originalContractX' in hexData && { originalContractX: hexData.originalContractX }),
      ...( 'originalContractY' in hexData && { originalContractY: hexData.originalContractY }),
      ...( 'side' in hexData && { side: hexData.side }),
      ...( 'layer' in hexData && { layer: hexData.layer }),
      ...( 'point' in hexData && { point: hexData.point }),
      ...(normalizedOwnerAddress && { ownerAddress: normalizedOwnerAddress }), 
      ...( 'ownerName' in hexData && hexData.ownerName && { ownerName: hexData.ownerName }),     
    };
    setSelectedHex(dataForState);
  };

  // REINSTATED getSelectedHexZoneInfo and selectedZoneInfo
  const getSelectedHexZoneInfo = () => {
    if (!selectedHex || selectedHex.originalContractX === undefined || selectedHex.originalContractY === undefined) return null;
    const zoneInfo = hexToZoneMap.get(`${selectedHex.originalContractX}-${selectedHex.originalContractY}`);
    return zoneInfo ? zoneInfo : null;
  };
  const selectedZoneInfo = getSelectedHexZoneInfo();

  if (loading || loadingMembers) { // Check both loading states
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
        <div className="map-visualization-area">
          {/* Selected Hex Info Panel - now an overlay */}
          {selectedHex && (
            <div className="selected-hex-info-overlay">
              <h3>Selected: {selectedHex.type}</h3>
              {/* REINSTATED Zone Name display - simplified */}
              {selectedZoneInfo && (
                <p>Zone: {selectedZoneInfo.zoneName}</p>
              )}
              {selectedHex.side !== undefined && selectedHex.layer !== undefined && selectedHex.point !== undefined && 
                <p>Side, Layer, Point : ({selectedHex.side}, {selectedHex.layer}, {selectedHex.point})</p>}
              {(selectedHex.normalizedX !== undefined && selectedHex.normalizedY !== undefined) && 
                <p>Normalized X, Y : ({selectedHex.normalizedX}, {selectedHex.normalizedY})</p>}
              
              {selectedHex.originalContractX !== undefined && selectedHex.originalContractY !== undefined && 
               occupiedSpotsSet.has(`${selectedHex.originalContractX}-${selectedHex.originalContractY}`) && 
                <p>Status: Occupied</p>}
              {selectedHex.ownerName && <p>Owner: {selectedHex.ownerName}</p>}
              {selectedHex.ownerAddress && <p>Owner Address: {selectedHex.ownerAddress}</p>}
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

          <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="hexagon-svg">
            <g>
              {/* Layer 1: Base potential spots (default color) */}
              {mapData.allPotentialSpots.map((spot) => {
                const spotKey = `potential-${spot.layer}-${spot.point}-${spot.originalContractX}-${spot.originalContractY}`;
                // REMOVED zoneInfo and zone-based fillColor
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

              {/* Layer 2: Occupied spots on top of zoned/default spots */}
              {mapData.allPotentialSpots
                .filter(spot => occupiedSpotsSet.has(`${spot.originalContractX}-${spot.originalContractY}`))
                .map((potentialSpot) => {
                  const spotContractIdentifier = `${potentialSpot.originalContractX}-${potentialSpot.originalContractY}`;
                  
                  // Get the full occupied spot data which includes owner info
                  const occupiedSpotData = occupiedSpotsMap.get(spotContractIdentifier);

                  if (!occupiedSpotData) return null; 

                  if (bankSpotsSet.has(spotContractIdentifier)) return null; 
                  if (mapData.center && potentialSpot.normalizedX === mapData.center.x && potentialSpot.normalizedY === mapData.center.y && potentialSpot.layer === 0 && potentialSpot.point === 0) return null;

                  const normalizedOwnerAddress = normalizeAddress(occupiedSpotData.ownerAddress);
                  let fillColor = OCCUPIED_FILL_COLOR; // Default for occupied
                  if (normalizedOwnerAddress && memberToColorMap.has(normalizedOwnerAddress)) {
                    fillColor = memberToColorMap.get(normalizedOwnerAddress)!;
                  }

                  const spotKey = `occupied-${potentialSpot.layer}-${potentialSpot.point}-${potentialSpot.originalContractX}-${potentialSpot.originalContractY}`;
                  return (
                    <HexagonTile
                      key={spotKey}
                      id={spotKey}
                      x={potentialSpot.normalizedX} // Use potentialSpot for x,y as it's the base rendering position
                      y={potentialSpot.normalizedY}
                      size={HEX_SIZE}
                      fillColor={fillColor} 
                      strokeColor={STROKE_COLOR}    
                      strokeWidth={HEX_STROKE_WIDTH}
                      onClick={() => {
                        handleHexClick(occupiedSpotData, 'Occupied Spot');
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