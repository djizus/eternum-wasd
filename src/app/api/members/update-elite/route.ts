import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface EliteUpdatePayload {
  identifier?: string; // This can be _id or address
  id?: string;         // Explicit _id if available
  address?: string;    // Explicit address if available
  isElite: boolean;
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as EliteUpdatePayload;
    const { identifier, id, address, isElite } = payload;

    if (typeof isElite !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload: isElite must be a boolean.' }, { status: 400 });
    }

    if (!identifier && !id && !address) {
      return NextResponse.json({ error: 'Invalid payload: identifier, id, or address is required.' }, { status: 400 });
    }

    const db = await getDatabase();
    const collection = db.collection('members');

    let query;
    if (id && ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else if (address) {
      query = { address: address }; 
    } else if (identifier && ObjectId.isValid(identifier)) {
      query = { _id: new ObjectId(identifier) }; 
    } else if (identifier) {
      query = { address: identifier };
    } else {
      // This case should ideally be caught by the check above, but as a safeguard:
      return NextResponse.json({ error: 'Could not determine a valid query for elite status update.' }, { status: 400 });
    }

    const result = await collection.updateOne(
      query,
      { $set: { isElite: isElite } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Elite status updated. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}` 
    });

  } catch (error) {
    console.error('Error in updating member elite status API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
} 