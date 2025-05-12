import { NextResponse } from 'next/server';
import { getDatabase } from '../../../lib/mongodb'; // Corrected path
import { Collection, Db } from 'mongodb'; // Import Db and Collection types

// Define the Member structure expected from the DB/API
interface Member {
  _id?: string;
  address?: string;
  username?: string;
  role?: 'warmonger' | 'farmer' | 'hybrid' | null;
  isElite?: boolean; // Keep isElite if it might exist
  // realmCount will be added by the aggregation
}

// Define the structure returned by this API route
interface MemberWithRealmCount extends Member {
  realmCount: number;
}

// No longer need RealmPassData interface for parsing single doc

export async function GET() {
  console.log("API route /api/members-with-realm-counts called");
  try {
    const db: Db = await getDatabase(); // Use Db type
    const membersCollection: Collection<Member> = db.collection('members');

    console.log("Starting aggregation pipeline...");

    const aggregationPipeline = [
      // Stage 1: Perform a left outer join to the realms collection
      {
        $lookup: {
          from: 'realms', // The collection to join
          let: { memberAddress: '$address' }, // Variable for the member's address
          pipeline: [
            // Pipeline within $lookup to match and count
            {
              $match: {
                $expr: {
                  // Match where realm's seasonPassOwner (case-insensitive) equals member's address
                  $eq: [
                    { $toLower: '$seasonPassOwner' }, // Convert realm owner to lowercase
                    { $toLower: '$$memberAddress' } // Convert member address to lowercase
                  ]
                }
              }
            },
            // Count the matched realms for this member
            {
              $count: 'matchedRealms'
            }
          ],
          as: 'realmData' // The array field added to each member document
        }
      },
      // Stage 2: Add the realmCount field
      {
        $addFields: {
          // If realmData array is not empty, take the count from the first element, otherwise default to 0
          realmCount: { $ifNull: [ { $first: '$realmData.matchedRealms' }, 0 ] }
        }
      },
      // Stage 3: Project to remove the temporary realmData field
      {
        $project: {
          realmData: 0 // Exclude the realmData field from the final output
        }
      }
    ];

    // Execute the aggregation pipeline
    const membersWithCounts: MemberWithRealmCount[] = await membersCollection.aggregate<MemberWithRealmCount>(aggregationPipeline).toArray();

    console.log(`Aggregation finished. Found ${membersWithCounts.length} members with counts.`);

    return NextResponse.json(membersWithCounts);

  } catch (error: unknown) {
    console.error('Error fetching members with realm counts via aggregation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: `Failed to fetch member data: ${errorMessage}` }, { status: 500 });
  }
} 