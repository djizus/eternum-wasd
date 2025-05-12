import { NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/mongodb';

// --- Configuration ---
const REALMS_COLLECTION = 'realms';
const SEASON_PASSES_SQL = process.env.SEASON_PASSES_SQL
const SEASON_PASSES_CONTRACT_ADDRESS = process.env.SEASON_PASSES_CONTRACT_ADDRESS

// --- Types ---
interface SqlResponseRow {
  token_id: string; // Use token_id directly
  account_address: string;
}

// --- API Route Handler (POST) ---
export async function POST(_request: Request) {
  try {
    console.log('Starting owner update process using SQL query...');
    
    // Construct the SQL query with the contract address
    const sqlQueryParams = `?query=select+*+%0Afrom+token_balances%0Ainner+join+tokens+on+token_balances.token_id+%3D+tokens.contract_address%7C%7C%22%3A%22%7C%7Ctokens.token_id%0Awhere+token_balances.contract_address+%3D+%22${SEASON_PASSES_CONTRACT_ADDRESS}%22%0Aand+token_balances.balance+%3D+%220x0000000000000000000000000000000000000000000000000000000000000001%22%0A%3B`;
    const sqlEndpoint = `${SEASON_PASSES_SQL}${sqlQueryParams}`;

    // Fetch data using the SQL query
    const response = await fetch(sqlEndpoint, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`SQL query failed: ${response.status} ${response.statusText}`);
    }

    const sqlData = await response.json();
    if (!Array.isArray(sqlData)) {
      throw new Error('Expected SQL response to be an array');
    }

    console.log(`Received ${sqlData.length} token balances from SQL query`);

    // Connect to the database once
    await connectToDatabase();
    const db = await getDatabase();
    const collection = db.collection(REALMS_COLLECTION);

    // Create an array of promises for update operations
    const updatePromises = sqlData.map(async (row: SqlResponseRow) => {
      const tokenIdHex = row.token_id;
      const ownerAddress = row.account_address;
      
      if (ownerAddress) {
         const tokenIdDecimal = parseInt(tokenIdHex, 16);
         if (!isNaN(tokenIdDecimal)){
            const decimalRealmIdString = tokenIdDecimal.toString();
            
            // Attempting to update Realm ID and Owner
            // console.log(`Attempting to update Realm ID: ${decimalRealmIdString} with Owner: ${ownerAddress}`); // Remove per-update logging

            // Update the specific document that contains this realm ID as a field name
            const updateResult = await collection.updateOne(
              { [decimalRealmIdString]: { $exists: true } }, // Filter: find document with this field name
              { $set: { [`${decimalRealmIdString}.owner`]: ownerAddress } }
            );
           // Remove per-update logging
           // console.log(`MongoDB update result for Realm ${decimalRealmIdString}: matchedCount=${updateResult.matchedCount}, modifiedCount=${updateResult.modifiedCount}`);

           // Return both matched and modified counts
           return { matchedCount: updateResult.matchedCount, modifiedCount: updateResult.modifiedCount };
         }
      }
      return { matchedCount: 0, modifiedCount: 0 }; // Return 0 counts if no update was attempted
    });

    // Run all update promises in parallel
    const results = await Promise.all(updatePromises);
    
    // Calculate total matched and modified counts
    const totalMatched = results.reduce((sum, result) => sum + result.matchedCount, 0);
    const totalModified = results.reduce((sum, result) => sum + result.modifiedCount, 0);

    console.log(`MongoDB update process finished. Total realms matched: ${totalMatched}, Total realms modified: ${totalModified}`);
      
    return NextResponse.json({ 
      message: 'Owner update process finished successfully.', 
      tokensProcessed: sqlData.length,
      realmsMatched: totalMatched,
      realmsModified: totalModified
    });

  } catch (error) {
    console.error('Unhandled error during owner update POST request:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// Optional: Simple GET handler for testing endpoint existence
export async function GET() {
  return NextResponse.json({ message: "Owner update endpoint. Use POST to trigger updates." });
} 