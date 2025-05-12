import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

// Helper type for clarity (matching the frontend Realm type structure)
interface RealmResponse {
  id: number;
  name: string;
  owner?: string;
  resources: string[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nameToFind = searchParams.get('name');
    
    console.log(`Fetching realms from MongoDB. Filtering by name: ${nameToFind || 'None'}`);

    const db = await getDatabase();
    const collection = db.collection('realms');

    // Fetch all documents instead of just one
    const realmDocs = await collection.find({}).toArray(); 
    
    if (!realmDocs || realmDocs.length === 0) {
      console.log('No realm documents found in the collection.');
      return NextResponse.json([], { status: 200 }); // Return empty array if no data
    }
    console.log(`Found ${realmDocs.length} realm documents in MongoDB.`);

    const processedRealms: RealmResponse[] = realmDocs.map(doc => {
      const resources: string[] = [];

      if (Array.isArray(doc.attributes)) {
        doc.attributes.forEach((attr: { trait_type: string; value: string | number }) => {
          // Check for Resources
          if (attr.trait_type === 'Resource') {
            const resourceId = String(attr.value);
            if (resourceId !== undefined) {
              resources.push(resourceId);
            } else {
              console.warn(`Unmapped resource name found in attributes for realm ${doc.realmId}: ${attr.value}`);
            }
          }
        });
      }

      // Construct the response object matching frontend expectations
      const realmResponse: RealmResponse = {
        id: doc.realmId, // Use realmId from DB
        name: doc.name,
        owner: doc.seasonPassOwner, // Use seasonPassOwner from DB
        resources: resources
      };
      return realmResponse;
    }).filter(realm => realm.id !== undefined && !isNaN(realm.id)); // Ensure valid ID

    console.log(`Processed ${processedRealms.length} realms after initial mapping.`);

    // Apply name filter if provided
    if (nameToFind) {
      const filteredRealms = processedRealms.filter(realm => 
          realm.name && realm.name.toLowerCase() === nameToFind.toLowerCase()
      );
      console.log(`Filtered down to ${filteredRealms.length} realm(s) matching name '${nameToFind}'.`);
      
      if (filteredRealms.length === 1) {
         return NextResponse.json(filteredRealms[0]); // Return single object if one match
      } else if (filteredRealms.length > 1) {
         console.warn(`Found multiple realms matching name '${nameToFind}'. Returning array.`);
         return NextResponse.json(filteredRealms); // Return array if multiple matches (shouldn't happen if name is unique)
      } else {
         return NextResponse.json({ error: `Realm with name '${nameToFind}' not found` }, { status: 404 });
      }
    } else {
      // Return all processed realms if no name filter
      console.log('Returning all processed realms.');
      return NextResponse.json(processedRealms);
    }

  } catch (error) {
    console.error('Error in realms API GET handler:', error);
    // Ensure error is serializable
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
} 