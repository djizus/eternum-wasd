import type { Realm } from '../types/resources';
import { ResourceDefinition, getResourceDefinitionFromName, RESOURCE_BANDS } from '../types/resources';

interface RawRealm {
  name: string;
  description: string;
  image: string;
  resources: string[];
  owner?: string;
}

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

    // Map MongoDB data and merge owner from ownerMap - UPDATED
    const finalRealms = realmEntries.map(([idString, realm]) => {
      const rawRealm = realm as RawRealm; // Assuming RawRealm might contain 'owner'
      const realmId = parseInt(idString, 10);
      // This correctly creates the array of resource name strings
      const resourceNames = rawRealm.resources
      // Map resource names (string[]) to ResourceDefinition[]
      const resourceDefinitions: ResourceDefinition[] = resourceNames
        .map(name => getResourceDefinitionFromName(name)) // Look up the definition by name
        // Filter out any names that didn't match a definition
        .filter((def): def is ResourceDefinition => def !== undefined);
      
      // Calculate available troops
      const realmResourceNames = new Set(resourceDefinitions.map(def => def.name));
      const availableTroops: string[] = [];
      for (const [troopBand, requiredResourceNames] of Object.entries(RESOURCE_BANDS)) {
        // Filter out undefined names that might result from getDef
        const validRequiredNames = requiredResourceNames.filter((name): name is string => name !== undefined);
        if (validRequiredNames.length === requiredResourceNames.length && // Ensure all names were valid initially
            validRequiredNames.every(name => realmResourceNames.has(name))) {
          availableTroops.push(troopBand);
        }
      }

      return {
        id: realmId, 
        name: rawRealm.name || `Realm ${realmId}`, 
        description: rawRealm.description || '',
        image: rawRealm.image || '',
        resources: resourceDefinitions,
        availableTroops: availableTroops, // Add calculated troops
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