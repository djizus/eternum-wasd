import { NextResponse } from 'next/server';
import { getDatabase } from '../../../lib/mongodb'; // Corrected path
import { ObjectId } from 'mongodb'; // Import ObjectId
// We don't need the full loadRealms service here, just direct DB access
// import { loadRealms } from '../../../services/realms'; 

// Define the Member structure expected from the DB/API
interface Member {
  _id?: string;
  address?: string;
  username?: string;
}

// Define the structure returned by this API route
interface MemberWithRealmCount extends Member {
  realmCount: number;
}

// Type for the individual realm/pass objects within the single document
interface RealmPassData {
  owner?: string;
  name?: string; // Example other property
  // Add other expected properties of a pass if known
}

// This type is for the raw document fetched, which might have an _id
// and other dynamic string keys pointing to RealmPassData.
// We won't use a direct index signature on this to avoid `any` for the values part.
interface FetchedPassesDocument {
  _id?: ObjectId; // Use specific ObjectId type
  // Other properties are dynamic keys [key: string]: RealmPassData
  // We will handle this by iterating with Object.entries and casting values.
}

export async function GET() {
  console.log("API route /api/members-with-realm-counts called");
  try {
    const db = await getDatabase();
    
    // 1. Fetch all members
    const membersCollection = db.collection('members');
    const members: Member[] = await membersCollection.find<Member>({}).toArray();
    console.log(`Fetched ${members.length} members`);

    // 2. Fetch the single document containing all realm data
    const realmsCollection = db.collection('realms'); 
    // Fetch the single document. The exact type from DB is complex, so cast to our expected shape.
    const allPassesDoc = await realmsCollection.findOne() as FetchedPassesDocument | null;

    if (!allPassesDoc) {
      console.error("No document found in 'realms' collection.");
      // Return members with 0 counts if realms doc is missing
      const membersWithZeroCounts = members.map(member => ({ ...member, realmCount: 0 }));
      return NextResponse.json(membersWithZeroCounts);
    }
    console.log("Fetched the single realms document.");

    // 3. Calculate realm counts per owner from the single document
    const realmCounts = new Map<string, number>();

    // Iterate using Object.entries, similar to loadRealms
    for (const [key, value] of Object.entries(allPassesDoc)) {
      if (key === '_id') { 
        continue; // Skip the _id field
      }

      // Now, 'value' is an individual pass object. Cast it to RealmPassData.
      const passData = value as RealmPassData; 
        
      if (passData && typeof passData === 'object' && passData.owner && typeof passData.owner === 'string') {
        const ownerAddress = passData.owner;
        const lowerCaseOwner = ownerAddress.toLowerCase();
        realmCounts.set(lowerCaseOwner, (realmCounts.get(lowerCaseOwner) || 0) + 1);
      } 
    }
    console.log(`Calculated counts for ${realmCounts.size} unique owners from the single document.`);

    // 4. Combine member data with realm counts
    let lookupExampleLogged = false; // Log only one example
    const membersWithCounts: MemberWithRealmCount[] = members.map(member => {
      const lowerCaseAddress = member.address ? member.address.toLowerCase() : null;
      const count = lowerCaseAddress ? realmCounts.get(lowerCaseAddress) || 0 : 0;
      
      // Log first lookup example
      if (!lookupExampleLogged && lowerCaseAddress) {
        console.log(`Example lookup: Member Addr (lower): ${lowerCaseAddress}, Found Count: ${realmCounts.has(lowerCaseAddress) ? count : 'Not Found in Map'}`);
        lookupExampleLogged = true;
      }

      return {
        ...member,
        realmCount: count,
      };
    });

    console.log("Finished mapping counts to members.");
    return NextResponse.json(membersWithCounts);

  } catch (error: unknown) {
    console.error('Error fetching members with realm counts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: `Failed to fetch member data: ${errorMessage}` }, { status: 500 });
  }
} 