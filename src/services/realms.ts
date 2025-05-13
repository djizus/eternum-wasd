import type { Realm } from '../types/resources';
import { ResourceDefinition, getResourceDefinitionFromName, RESOURCE_BANDS } from '../types/resources';

// Interface for the raw object structure expected from /api/realms when it returns an array
// This should match the RealmResponse interface in /api/realms/route.ts
interface ApiRealmObject {
  id: number;
  name: string;
  owner?: string;
  resources: string[]; 
}

export const loadRealms = async (): Promise<Realm[]> => {
  console.log("Starting loadRealms...");
  try {
    console.log("Fetching realm data from /api/realms...");
    const realmsResponse = await fetch('/api/realms');
    if (!realmsResponse.ok) {
      throw new Error(`Failed to fetch realms: ${realmsResponse.statusText}`);
    }
    
    // Expect an array of ApiRealmObject from the API
    const realmsDataArray: ApiRealmObject[] = await realmsResponse.json();

    if (!Array.isArray(realmsDataArray)) {
      console.error('Invalid realms data received from API (expected an array):', realmsDataArray);
      return [];
    }
    console.log(`Successfully fetched ${realmsDataArray.length} realm objects.`);

    const finalRealms = realmsDataArray.map((apiRealm) => {
      // Map resource names (string[]) from API to ResourceDefinition[]
      const resourceDefinitions: ResourceDefinition[] = (apiRealm.resources || []) // Ensure apiRealm.resources is treated as an array
        .map(name => getResourceDefinitionFromName(name))
        .filter((def): def is ResourceDefinition => def !== undefined);
      
      const realmResourceNames = new Set(resourceDefinitions.map(def => def.name));
      const availableTroops: string[] = [];
      for (const [troopBand, requiredResourceNames] of Object.entries(RESOURCE_BANDS)) {
        const validRequiredNames = requiredResourceNames.filter((name): name is string => name !== undefined);
        if (validRequiredNames.length === requiredResourceNames.length &&
            validRequiredNames.every(name => realmResourceNames.has(name))) {
          availableTroops.push(troopBand);
        }
      }

      // Construct the Realm object for the Dashboard
      return {
        id: apiRealm.id, // Use the id directly from the API response object
        name: apiRealm.name || `Realm ${apiRealm.id}`,
        description: '', // Provide default if not in ApiRealmObject (Realm type might expect it)
        image: '',       // Provide default if not in ApiRealmObject
        resources: resourceDefinitions,
        availableTroops: availableTroops,
        owner: apiRealm.owner, // Use owner directly from the API response object
      };
    });
    console.log(`Processed ${finalRealms.length} realms. loadRealms finished.`);
    return finalRealms;

  } catch (error) {
    console.error('Error in loadRealms:', error);
    return []; 
  }
}; 