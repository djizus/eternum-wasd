import type { Realm } from '../types/resources';
import { ResourcesIds } from '../types/resources';

// Troop requirements: each troop maps to an array of required resource IDs
const TROOP_REQUIREMENTS: Partial<Record<ResourcesIds, ResourcesIds[]>> = {
  [ResourcesIds.Knight]: [ResourcesIds.Copper, ResourcesIds.Obsidian],
  [ResourcesIds.KnightT2]: [ResourcesIds.Hartwood, ResourcesIds.Diamonds],
  [ResourcesIds.KnightT3]: [ResourcesIds.TrueIce, ResourcesIds.Adamantine],
  [ResourcesIds.Crossbowman]: [ResourcesIds.Silver, ResourcesIds.Ironwood],
  [ResourcesIds.CrossbowmanT2]: [ResourcesIds.Sapphire, ResourcesIds.Ruby],
  [ResourcesIds.CrossbowmanT3]: [ResourcesIds.TwilightQuartz, ResourcesIds.Mithral],
  [ResourcesIds.Paladin]: [ResourcesIds.Copper, ResourcesIds.Gold],
  [ResourcesIds.PaladinT2]: [ResourcesIds.DeepCrystal, ResourcesIds.Ignium],
  [ResourcesIds.PaladinT3]: [ResourcesIds.AlchemicalSilver, ResourcesIds.Dragonhide],
};

const IGNORED_RESOURCES = [ResourcesIds.Wheat, ResourcesIds.Fish, ResourcesIds.Labor];

// Utility to map resource name (trait) to ResourcesIds enum value
function findResourceIdByTrait(trait: string): ResourcesIds | undefined {
  const normalized = trait.replace(/\s|_/g, '').toLowerCase();
  for (const [key, value] of Object.entries(ResourcesIds)) {
    if (typeof value === 'number') {
      const keyNorm = key.replace(/\s|_/g, '').toLowerCase();
      if (keyNorm === normalized) return value as ResourcesIds;
    }
  }
  return undefined;
}

// Function to determine available troops based on resources
const determineAvailableTroops = (resources: string[]): ResourcesIds[] => {
  const availableTroops: ResourcesIds[] = [];
  const resourceIds = resources
    .map(resource => findResourceIdByTrait(resource))
    .filter((id): id is ResourcesIds => id !== undefined && !IGNORED_RESOURCES.includes(id));

  // Helper to check if all requirements are present
  const hasAll = (reqs: ResourcesIds[]) => reqs.every(r => resourceIds.includes(r));

  for (const troopId of Object.keys(TROOP_REQUIREMENTS).map(Number) as ResourcesIds[]) {
    const requirements = TROOP_REQUIREMENTS[troopId];
    if (requirements && hasAll(requirements)) {
      availableTroops.push(troopId);
    }
  }
  return availableTroops;
};

// Function to determine resource chains based on available resources
const determineResourceChains = (resources: string[]): ResourcesIds[][] => {
  const chains: ResourcesIds[][] = [];
  const resourceIds = resources
    .map(resource => findResourceIdByTrait(resource))
    .filter((id): id is ResourcesIds => id !== undefined && !IGNORED_RESOURCES.includes(id));

  // Example chain detection
  if (resourceIds.includes(ResourcesIds.Copper) && resourceIds.includes(ResourcesIds.Obsidian)) {
    chains.push([ResourcesIds.Copper, ResourcesIds.Obsidian, ResourcesIds.Silver]);
  }
  if (resourceIds.includes(ResourcesIds.Silver) && resourceIds.includes(ResourcesIds.Ironwood)) {
    chains.push([ResourcesIds.Silver, ResourcesIds.Ironwood, ResourcesIds.ColdIron]);
  }

  return chains;
};

interface RealmAttribute {
  trait_type: string;
  value: string | number;
}

interface RawRealm {
  name: string;
  description: string;
  image: string;
  attributes: RealmAttribute[];
  owner?: string;
}

// --- Updated loadRealms --- 

export const loadRealms = async (): Promise<Realm[]> => {
  console.log("Starting loadRealms...");
  try {
    // 1. Fetch base realm data
    console.log("Fetching base realm data...");
    const realmsResponse = await fetch('/api/realms');
    if (!realmsResponse.ok) {
      throw new Error(`Failed to fetch realms: ${realmsResponse.statusText}`);
    }
    const realmsData = await realmsResponse.json();
    if (typeof realmsData !== 'object' || realmsData === null) {
        console.error('Invalid realms data received from API:', realmsData);
        return [];
    }
    console.log("Base realm data fetched.");

    const realmEntries = Object.entries(realmsData);
    // const realmIds = realmEntries.map(([idString]) => parseInt(idString, 10)); // No longer needed here
    // console.log(`Found ${realmIds.length} realm IDs.`);

    // 2. Fetch owners in parallel using RPC calls - REMOVED
    // console.log("Fetching owners via RPC...");
    // const ownerPromises = realmIds.map(id => fetchOwnerForRealm(id));
    
    // Use Promise.allSettled to handle potential errors for individual calls
    // const ownerResults = await Promise.allSettled(ownerPromises);
    // console.log("Owner RPC calls settled.");

    // 3. Process results into an ownerMap - REMOVED
    // const ownerMap: Record<number, string> = {};
    // let ownersFound = 0;
    // ownerResults.forEach((result, index) => {
    //   if (result.status === 'fulfilled' && result.value[1] !== null) {
    //     const [realmId, ownerAddress] = result.value;
    //     ownerMap[realmId] = ownerAddress;
    //     ownersFound++;
    //   } else if (result.status === 'rejected') {
    //     console.error(`Owner fetch promise rejected for realm ID ${realmIds[index]}:`, result.reason);
    //   }
    //   // Fulfilled but null owner means no owner found via RPC - do nothing
    // });
    // console.log(`Processed owner results. Found ${ownersFound} owners.`);

    // 4. Map MongoDB data and merge owner from ownerMap - UPDATED
    console.log("Merging data from MongoDB...");
    const finalRealms = realmEntries.map(([idString, realm]) => {
      const rawRealm = realm as RawRealm; // Assuming RawRealm might contain 'owner'
      const realmId = parseInt(idString, 10);
      const attributes = rawRealm.attributes || [];
      
      const resources = attributes
        .filter((attr: RealmAttribute) => attr.trait_type === 'Resource')
        .map((attr: RealmAttribute) => {
          const resourceId = findResourceIdByTrait(attr.value as string);
          return resourceId !== undefined ? { resource: resourceId, amount: 1000 } : undefined;
        })
        .filter((r): r is { resource: ResourcesIds; amount: number } => r !== undefined);

      const resourceNames = attributes
        .filter((attr: RealmAttribute) => attr.trait_type === 'Resource')
        .map((attr: RealmAttribute) => attr.value as string);

      return {
        id: realmId, 
        name: rawRealm.name || `Realm ${realmId}`, 
        description: rawRealm.description || '',
        image: rawRealm.image || '',
        resources,
        availableTroops: determineAvailableTroops(resourceNames),
        resourceChains: determineResourceChains(resourceNames),
        attributes: attributes.reduce((acc: Record<string, string | number>, attr: RealmAttribute) => {
          if (attr.trait_type !== 'Resource') { 
            acc[attr.trait_type.toLowerCase()] = attr.value; 
          }
          return acc;
        }, {} as Record<string, string | number>),
        owner: rawRealm.owner, // Directly use owner from MongoDB data
      };
    });
    console.log("Data merging complete. loadRealms finished.");
    return finalRealms;

  } catch (error) {
    console.error('Error in loadRealms:', error);
    return []; // Return empty array on error
  }
}; 