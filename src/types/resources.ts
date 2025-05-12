type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'troop';

export interface ResourceDefinition {
  id: number;
  name: string;
  rarity: Rarity;
}

// Define all resources with their ID, name, and rarity
export const RESOURCE_DEFINITIONS: ResourceDefinition[] = [
  // Common Materials
  { id: 0, name: 'Wood', rarity: 'common' },
  { id: 1, name: 'Stone', rarity: 'common' },
  { id: 2, name: 'Coal', rarity: 'common' },
  { id: 3, name: 'Copper', rarity: 'common' },
  // Rare Materials
  { id: 4, name: 'Obsidian', rarity: 'rare' },
  { id: 5, name: 'Silver', rarity: 'rare' },
  { id: 6, name: 'Ironwood', rarity: 'rare' },
  { id: 7, name: 'Cold Iron', rarity: 'rare' },
  // Epic Materials
  { id: 8, name: 'Gold', rarity: 'epic' },
  { id: 9, name: 'Hartwood', rarity: 'epic' },
  { id: 10, name: 'Diamonds', rarity: 'epic' },
  { id: 11, name: 'Sapphire', rarity: 'epic' },
  { id: 12, name: 'Ruby', rarity: 'epic' },
  // Legendary Materials
  { id: 13, name: 'Deep Crystal', rarity: 'legendary' },
  { id: 14, name: 'Ignium', rarity: 'legendary' },
  { id: 15, name: 'Ethereal Silica', rarity: 'legendary' },
  { id: 16, name: 'True Ice', rarity: 'legendary' },
  { id: 17, name: 'Twilight Quartz', rarity: 'legendary' },
  { id: 18, name: 'Alchemical Silver', rarity: 'legendary' },
  { id: 19, name: 'Adamantine', rarity: 'legendary' },
  { id: 20, name: 'Mithral', rarity: 'legendary' },
  { id: 21, name: 'Dragonhide', rarity: 'legendary' },
  // Troops (Marked with 'troop' rarity for easy filtering)
  { id: 25, name: 'Knight', rarity: 'troop' }, // T1 - Rare
  { id: 26, name: 'KnightT2', rarity: 'troop' }, // T2 - Epic
  { id: 27, name: 'KnightT3', rarity: 'troop' }, // T3 - Legendary
  { id: 28, name: 'Crossbowman', rarity: 'troop' }, // T1 - Rare
  { id: 29, name: 'CrossbowmanT2', rarity: 'troop' }, // T2 - Epic
  { id: 30, name: 'CrossbowmanT3', rarity: 'troop' }, // T3 - Legendary
  { id: 31, name: 'Paladin', rarity: 'troop' }, // T1 - Rare
  { id: 32, name: 'PaladinT2', rarity: 'troop' }, // T2 - Epic
  { id: 33, name: 'PaladinT3', rarity: 'troop' }, // T3 - Legendary
  // Other/Utility (Marked as common or other appropriate rarity)
  { id: 22, name: 'Labor', rarity: 'common' },
  { id: 23, name: 'Ancient Fragment', rarity: 'common' },
  { id: 24, name: 'Donkey', rarity: 'common' },
  { id: 34, name: 'Lords', rarity: 'common' },
  { id: 35, name: 'Wheat', rarity: 'common' },
  { id: 36, name: 'Fish', rarity: 'common' },
];

// Map: resource ID -> ResourceDefinition
export const RESOURCE_ID_MAP = new Map<number, ResourceDefinition>();
RESOURCE_DEFINITIONS.forEach(def => {
  RESOURCE_ID_MAP.set(def.id, def);
});

// Create lookup maps for efficient access
// Map: resource name (lowercase, no spaces) -> ResourceDefinition
export const RESOURCE_NAME_MAP = new Map<string, ResourceDefinition>();
RESOURCE_DEFINITIONS.forEach(def => {
  const normalizedName = def.name.replace(/\s+/g, '').toLowerCase();
  RESOURCE_NAME_MAP.set(normalizedName, def);
});

// Function to safely get ResourceDefinition from name string
export function getResourceDefinitionFromName(name: string): ResourceDefinition | undefined {
    const normalizedName = name?.replace(/\s+/g, '').toLowerCase();
    return RESOURCE_NAME_MAP.get(normalizedName);
}

// List of resource IDs to exclude from the filter dropdown (e.g., basic/non-valuable)
export const EXCLUDED_RESOURCES = [
  RESOURCE_DEFINITIONS.find(r => r.id === 22)?.name,
  RESOURCE_DEFINITIONS.find(r => r.id === 23)?.name,
  RESOURCE_DEFINITIONS.find(r => r.id === 24)?.name,
  RESOURCE_DEFINITIONS.find(r => r.id === 34)?.name,
  RESOURCE_DEFINITIONS.find(r => r.id === 35)?.name,
  RESOURCE_DEFINITIONS.find(r => r.id === 36)?.name,
];

// Helper function to get definition or throw error/return null
function getDef(id: number): ResourceDefinition | undefined {
  const def = RESOURCE_ID_MAP.get(id);
  if (!def) {
    console.warn(`Resource definition not found for ID: ${id}`); // Or throw new Error(...)
  }
  return def;
}

// Define troop requirements using IDs first
const troopRequirementDefs: { troopId: number; reqIds: number[] }[] = [
  { troopId: 25, reqIds: [4, 7] },       // Knight: Obsidian, Cold Iron
  { troopId: 26, reqIds: [12, 13] },      // KnightT2: Ruby, Deep Crystal
  { troopId: 27, reqIds: [17, 20] },      // KnightT3: Twilight Quartz, Mithral
  { troopId: 28, reqIds: [5, 6] },       // Crossbowman: Silver, Ironwood
  { troopId: 29, reqIds: [10, 15] },      // CrossbowmanT2: Diamonds, Ethereal Silica
  { troopId: 30, reqIds: [16, 21] },      // CrossbowmanT3: True Ice, Dragonhide
  { troopId: 31, reqIds: [3, 8] },       // Paladin: Copper, Gold
  { troopId: 32, reqIds: [11, 14] },      // PaladinT2: Sapphire, Ignium
  { troopId: 33, reqIds: [18, 19] },      // PaladinT3: Alchemical Silver, Adamantine
];

// Initialize the final map
export const TROOP_REQUIREMENTS: Map<number, ResourceDefinition[]> = new Map();

// Populate the map safely
troopRequirementDefs.forEach(({ troopId, reqIds }) => {
  const requiredDefinitions = reqIds
    .map(id => getDef(id)) // Get ResourceDefinition for each required ID
    .filter((def): def is ResourceDefinition => def !== undefined); // Filter out any not found
  
  // Only set if we found valid definitions (optional, prevents empty arrays if needed)
  if (requiredDefinitions.length === reqIds.length) { 
    TROOP_REQUIREMENTS.set(troopId, requiredDefinitions);
  } else {
    // Log a warning if some required definitions were missing for a troop
    console.warn(`Could not find all required definitions for troop ID: ${troopId}`);
  }
});

// RESOURCE_BANDS can also be simplified using the map
export const RESOURCE_BANDS = {
  "KNIGHT_T1": [getDef(4)?.name, getDef(7)?.name],         // Obsidian, Cold Iron
  "KNIGHT_T2": [getDef(12)?.name, getDef(13)?.name],        // Ruby, Deep Crystal
  "KNIGHT_T3": [getDef(17)?.name, getDef(20)?.name],        // Twilight Quartz, Mithral
  "CROSSBOWMAN_T1": [getDef(5)?.name, getDef(6)?.name],     // Silver, Ironwood
  "CROSSBOWMAN_T2": [getDef(10)?.name, getDef(15)?.name],    // Diamonds, Ethereal Silica
  "CROSSBOWMAN_T3": [getDef(16)?.name, getDef(21)?.name],    // True Ice, Dragonhide
  "PALADIN_T1": [getDef(3)?.name, getDef(8)?.name],         // Copper, Gold
  "PALADIN_T2": [getDef(11)?.name, getDef(14)?.name],        // Sapphire, Ignium
  "PALADIN_T3": [getDef(18)?.name, getDef(19)?.name],        // Alchemical Silver, Adamantine
} as const;

export interface Realm {
  id: number;
  name: string;
  description: string;
  image: string;
  resources: ResourceDefinition[];
  availableTroops: string[];
  owner?: string;
}