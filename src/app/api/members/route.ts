import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDatabase();
    const collection = db.collection('members');
    const members = await collection.find({}).toArray();
    return NextResponse.json(members);
  } catch (error) {
    console.error('Error in members API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { address, username } = await request.json();
    
    if (!address && !username) {
      return NextResponse.json(
        { error: 'Address or username required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const collection = db.collection('members');
    await collection.insertOne({ address, username });
    
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error in members API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { address, username } = await request.json();
    
    if (!address && !username) {
      return NextResponse.json(
        { error: 'Address or username required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const collection = db.collection('members');
    const query = address ? { address } : { username };
    await collection.deleteOne(query);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in members API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 