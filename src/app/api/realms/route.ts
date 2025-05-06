import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    const db = await getDatabase();
    const collection = db.collection('realms');

    if (id) {
      const realmId = parseInt(id, 10);
      const allRealmsDoc = await collection.findOne({}); 
      if (!allRealmsDoc || !allRealmsDoc[id]) {
        return NextResponse.json({ error: 'Realm not found' }, { status: 404 });
      }
      const realm = { ...allRealmsDoc[id], id: realmId };
      return NextResponse.json(realm);
    } else {
      const allRealmsDoc = await collection.findOne({}); 
      if (!allRealmsDoc) {
        return NextResponse.json({});
      }
      // Create a new object excluding the _id property
      const { _id: __id, ...realmsWithoutId } = allRealmsDoc;
      return NextResponse.json(realmsWithoutId);
    }
  } catch (error) {
    console.error('Error in realms API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 