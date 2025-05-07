import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface RoleUpdatePayload {
  identifier: string; // This can be _id or address
  id?: string; // Explicit _id if available
  address?: string; // Explicit address if available
  role: 'warmonger' | 'farmer' | 'hybrid' | null;
}

export async function PUT(request: Request) {
  try {
    const { roles } = await request.json() as { roles: RoleUpdatePayload[] };

    if (!Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ error: 'Invalid payload: roles array is required.' }, { status: 400 });
    }

    const db = await getDatabase();
    const collection = db.collection('members');
    const bulkOperations = [];

    for (const roleUpdate of roles) {
      const { identifier, id, address, role } = roleUpdate;
      
      if (!identifier && !id && !address) {
        console.warn('Skipping role update due to missing identifier, id, or address:', roleUpdate);
        continue; // Skip if no valid identifier
      }

      // Determine the query to find the member document
      let query;
      if (id && ObjectId.isValid(id)) {
        query = { _id: new ObjectId(id) };
      } else if (address) {
        query = { address: address }; 
      } else if (identifier && ObjectId.isValid(identifier)) {
        // Fallback to identifier if it might be an ObjectId
        query = { _id: new ObjectId(identifier) }; 
      } else if (identifier) {
        // Fallback to identifier if it might be an address
        query = { address: identifier };
      } else {
        console.warn('Could not determine a valid query for role update:', roleUpdate);
        continue;
      }
      
      // Prepare the update operation
      bulkOperations.push({
        updateOne: {
          filter: query,
          update: { $set: { role: role } },
        },
      });
    }

    if (bulkOperations.length === 0) {
      return NextResponse.json({ message: 'No valid role updates to perform.' }, { status: 200 });
    }

    const result = await collection.bulkWrite(bulkOperations);

    return NextResponse.json({ 
      success: true, 
      message: `Roles updated. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}` 
    });

  } catch (error) {
    console.error('Error in updating member roles API:', error);
    // Check if error is an instance of Error to safely access message property
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
} 