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
  // MapCenter specific fields are already covered by Partial<HexSpot> or are x/y renamed
  x?: number; // from MapCenter, will be mapped to normalizedX
  y?: number; // from MapCenter, will be mapped to normalizedY
}

interface MapData {
  maxLayers: number;
  center: MapCenter;
  banks: HexSpot[]; // Assuming banks also follow the HexSpot structure
  allPotentialSpots: HexSpot[];
  occupiedContractSpots: { [key: string]: HexSpot }; // Object mapping stringified index to HexSpot
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

// Ordered Zone Colors (Progression: Purples -> Blues -> Greens -> Yellows -> Oranges -> Reds)
const ZONE_COLORS: { [key: number]: string } = {
  1: '#be4bdb', // Bright Purple
  2: '#845ef7', // Indigo
  3: '#5c7cfa', // Bright Blue
  4: '#339af0', // Medium Blue
  5: '#22b8cf', // Cyan
  6: '#20c997', // Teal/Mint Green
  7: '#51cf66', // Bright Green
  8: '#fcc419', // Yellow
  9: '#ff922b', // Orange
  10: '#ff6b6b', // Coral/Light Red
  11: '#fa5252', // Red
  12: '#e03131'  // Deeper Red
};

const SettlingMapPage: React.FC = () => {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHex, setSelectedHex] = useState<SelectedHexData | null>(null); // Updated type

  const bankSpotsSet = useMemo(() => {
    if (!mapData) return new Set<string>();
    const set = new Set<string>();
    mapData.banks.forEach(bank => set.add(`${bank.originalContractX}-${bank.originalContractY}`));
    return set;
  }, [mapData]);

  const occupiedSpotsSet = useMemo(() => {
    if (!mapData || !mapData.occupiedContractSpots) return new Set<string>();
    const set = new Set<string>();
    Object.values(mapData.occupiedContractSpots).forEach(spot => set.add(`${spot.originalContractX}-${spot.originalContractY}`));
    return set;
  }, [mapData]);

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

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/eternum_settlement_map_data.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch map data: ${response.status} ${response.statusText}`);
        }
        const data: MapData = await response.json();
        setMapData(data);
      } catch (err: unknown) {
        console.error("Error fetching map data:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMapData();
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
    const dataForState: SelectedHexData = {
      type: type,
      normalizedX: 'normalizedX' in hexData ? hexData.normalizedX : hexData.x,
      normalizedY: 'normalizedY' in hexData ? hexData.normalizedY : hexData.y,
      ...( 'originalContractX' in hexData && { originalContractX: hexData.originalContractX }),
      ...( 'originalContractY' in hexData && { originalContractY: hexData.originalContractY }),
      ...( 'side' in hexData && { side: hexData.side }),
      ...( 'layer' in hexData && { layer: hexData.layer }),
      ...( 'point' in hexData && { point: hexData.point }),
    };
    setSelectedHex(dataForState);
  };

  if (loading) {
    return <div className="map-loading">Loading Map Data...</div>;
  }

  if (error) {
    return <div className="map-error">Error loading map: {error}</div>;
  }

  if (!mapData) {
    return <div className="map-no-data">No map data available.</div>;
  }

  const getSelectedHexZoneInfo = () => {
    if (!selectedHex || !selectedHex.originalContractX || !selectedHex.originalContractY) return null;
    const zoneInfo = hexToZoneMap.get(`${selectedHex.originalContractX}-${selectedHex.originalContractY}`);
    return zoneInfo ? zoneInfo : null;
  };
  const selectedZoneInfo = getSelectedHexZoneInfo();

  return (
    <div className="settling-map-root">
      <div className="map-container">
        <div className="map-visualization-area">
          {/* Selected Hex Info Panel - now an overlay */}
          {selectedHex && (
            <div className="selected-hex-info-overlay">
              <h3>Selected: {selectedHex.type}</h3>
              {selectedZoneInfo && (() => {
                const { zoneName, zoneId } = selectedZoneInfo;
                let suffix = '';
                if (zoneId >= 1 && zoneId <= 6) {
                  suffix = ' (Center)';
                } else if (zoneId >= 7 && zoneId <= 12) {
                  suffix = ' (Bank)';
                }

                let finalDisplayName = zoneName;
                if (suffix) {
                  const lowerZoneName = zoneName.toLowerCase();
                  // Only add suffix if zoneName doesn't already contain a pattern like " (bank" or " (center"
                  if (!lowerZoneName.includes(' (bank') && !lowerZoneName.includes(' (center')) {
                    finalDisplayName = `${zoneName}${suffix}`;
                  }
                }
                
                return (
                  <h4 style={{
                    color: ZONE_COLORS[zoneId] || 'inherit',
                    margin: '0.5em 0',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    fontSize: '1.5em'
                  }}>
                    {finalDisplayName}
                  </h4>
                );
              })()}
              {selectedHex.side !== undefined && selectedHex.layer !== undefined && selectedHex.point !== undefined && 
                <p>Side, Layer, Point : ({selectedHex.side}, {selectedHex.layer}, {selectedHex.point})</p>}
              {(selectedHex.normalizedX !== undefined && selectedHex.normalizedY !== undefined) && 
                <p>Normalized X, Y : ({selectedHex.normalizedX}, {selectedHex.normalizedY})</p>}
              
              {selectedHex.originalContractX !== undefined && selectedHex.originalContractY !== undefined && 
               occupiedSpotsSet.has(`${selectedHex.originalContractX}-${selectedHex.originalContractY}`) && 
                <p>Status: Occupied</p>}
            </div>
          )}
          {!selectedHex && (
             <div className="selected-hex-info-overlay placeholder">
                <p>Click on a hexagon to see its details.</p>
             </div>
          )}

          {/* Zone Legend */} 
          {mapData.zones && mapData.zones.length > 0 && (
            <div className="zone-legend-overlay">
              <h4>Zone Legend</h4>
              <ul>
                {mapData.zones
                  .sort((a, b) => a.zoneId - b.zoneId) // Ensure zones are sorted by ID for legend
                  .map(zone => (
                  <li key={zone.zoneId}>
                    <span 
                      className="legend-color-swatch"
                      style={{ backgroundColor: ZONE_COLORS[zone.zoneId] || '#ccc' }}
                    ></span>
                    Zone {zone.zoneId}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="hexagon-svg">
            <g>
              {/* Layer 1: Base potential spots (zoned or default) */}
              {mapData.allPotentialSpots.map((spot) => {
                const spotContractIdentifier = `${spot.originalContractX}-${spot.originalContractY}`;
                const spotKey = `potential-${spot.layer}-${spot.point}-${spot.originalContractX}-${spot.originalContractY}`;
                const zoneInfo = hexToZoneMap.get(spotContractIdentifier);
                const fillColor = zoneInfo ? (ZONE_COLORS[zoneInfo.zoneId] || DEFAULT_FILL_COLOR) : DEFAULT_FILL_COLOR;

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
                .map((spot) => {
                  const spotContractIdentifier = `${spot.originalContractX}-${spot.originalContractY}`;
                  if (bankSpotsSet.has(spotContractIdentifier)) return null; 
                  if (mapData.center && spot.normalizedX === mapData.center.x && spot.normalizedY === mapData.center.y && spot.layer === 0 && spot.point === 0) return null;

                  const spotKey = `occupied-${spot.layer}-${spot.point}-${spot.originalContractX}-${spot.originalContractY}`;
                  return (
                    <HexagonTile
                      key={spotKey}
                      id={spotKey}
                      x={spot.normalizedX}
                      y={spot.normalizedY}
                      size={HEX_SIZE}
                      fillColor={OCCUPIED_FILL_COLOR} 
                      strokeColor={STROKE_COLOR}    
                      strokeWidth={HEX_STROKE_WIDTH}
                      onClick={() => handleHexClick(spot, 'Occupied Spot')}
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