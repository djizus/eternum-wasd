import { NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/mongodb';

// --- Configuration ---
const REALMS_COLLECTION = 'realms';
// Environment variables for owner SQL query
const SEASON_PASSES_SQL = process.env.SEASON_PASSES_SQL;
const SEASON_PASSES_CONTRACT_ADDRESS = process.env.SEASON_PASSES_CONTRACT_ADDRESS;
// Metadata SQL endpoint
const REALMS_METADATA_SQL_URL = `${SEASON_PASSES_SQL}?query=select+*%0Afrom+tokens%0Awhere+contract_address+%3D+%220x7ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809%22%0A`;

// --- Types ---
// Type for the raw metadata SQL response row
interface SqlTokenResponseRow {
  contract_address: string;
  decimals: number;
  id: string; // Composite ID
  metadata: string; // JSON string
  name: string; // e.g., "Realms (for Adventurers)"
  symbol: string; // e.g., "LootRealm"
  token_id: string; // Hex token ID (e.g., "0x0...0531")
}

// Type for the parsed metadata from the JSON string
interface ParsedMetadata {
  attributes: { trait_type: string; value: string | number }[];
  image: string;
  name: string; // Actual realm name (e.g., "Dashu")
  description?: string; // Optional description
}

// Updated Type for the owner SQL response row to match the provided JSON structure
interface SqlOwnerResponseRow {
  account_address: string; 
  balance: string;
  contract_address: string;
  decimals: number;
  id: string; // Composite ID (e.g., contract_address:token_id)
  metadata: string; // JSON string containing attributes, image, name (realm name)
  name: string; // Collection name (e.g., "Eternum Season 1 Pass")
  symbol: string; // Collection symbol (e.g., "ESP1")
  token_id: string; // Hex token ID (the part used for matching)
}

// Structure for individual realm documents in MongoDB
interface RealmDocumentForMongo {
  realmId: number; // Numeric ID for filtering/indexing
  name: string;
  image: string;
  attributes: { trait_type: string; value: string | number }[];
  seasonPassOwner?: string;
  // Add other relevant fields if needed
}

// --- Define a specific type for the bulk write operations ---
interface MongoBulkWriteOperation {
  updateOne: {
    filter: { realmId: number };
    update: { $set: RealmDocumentForMongo }; // Assuming realmDocument is not null when pushed
    upsert: boolean;
  };
  // Add other operation types like insertOne, deleteOne if needed later
}

// --- API Route Handler (POST) ---
export async function POST(_request: Request) {
  // Check if environment variables for owner query are set
  if (!SEASON_PASSES_SQL || !SEASON_PASSES_CONTRACT_ADDRESS) {
    const errorMsg = 'Server configuration error: Missing SEASON_PASSES_SQL or SEASON_PASSES_CONTRACT_ADDRESS environment variables for owner lookup.';
    console.error(errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }

  try {
    console.log('Starting realm data upsert process (including owners)...');

    // --- 1. Fetch Realm Metadata --- 
    console.log('Fetching realm metadata from SQL...');
    const metadataResponse = await fetch(REALMS_METADATA_SQL_URL);

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      throw new Error(`SQL query for metadata failed: ${metadataResponse.status} ${metadataResponse.statusText} - ${errorText}`);
    }
    const metadataSqlData: SqlTokenResponseRow[] = await metadataResponse.json();
    if (!Array.isArray(metadataSqlData)) {
      throw new Error('Expected SQL response for metadata to be an array');
    }
    console.log(`Received ${metadataSqlData.length} realm tokens from metadata SQL query.`);

    // --- 2. Fetch Owner Data --- 
    console.log('Fetching owner data from SQL...');
    // Construct the owner SQL query (similar to old update-owners)
    // Selecting only token_id and account_address for efficiency
    const ownerSqlQuery = `?query=select+*+%0Afrom+token_balances%0Ainner+join+tokens+on+token_balances.token_id+%3D+tokens.contract_address%7C%7C%22%3A%22%7C%7Ctokens.token_id%0Awhere+token_balances.contract_address+%3D+%22${SEASON_PASSES_CONTRACT_ADDRESS}%22%0Aand+token_balances.balance+%3D+%220x0000000000000000000000000000000000000000000000000000000000000001%22%0A%3B`;
    const ownerSqlEndpoint = `${SEASON_PASSES_SQL}${ownerSqlQuery}`;
    const ownerResponse = await fetch(ownerSqlEndpoint);
    if (!ownerResponse.ok) {
      const errorText = await ownerResponse.text();
      throw new Error(`SQL query for owners failed: ${ownerResponse.status} ${ownerResponse.statusText} - ${errorText}`);
    }
    const ownerSqlData: SqlOwnerResponseRow[] = await ownerResponse.json();
    if (!Array.isArray(ownerSqlData)) {
       throw new Error('Expected SQL response for owners to be an array');
    }
    console.log(`Received ${ownerSqlData.length} owner records from SQL query.`);

    // --- 3. Merge Data and Prepare Bulk Operations --- 
    console.log('Processing metadata and searching for owners...');
    const bulkOps: MongoBulkWriteOperation[] = []; // Use the specific type
    let ownersFoundCount = 0;

    for (const metadataRow of metadataSqlData) {
      let ownerAddress: string | undefined = undefined; // Reset for each metadata row
      let realmDocument: RealmDocumentForMongo | null = null; // Initialize as null
      let metadataTokenIdDecimal: number; // Declare once here

      // --- Parse Metadata Row --- 
      if (!metadataRow.metadata || typeof metadataRow.metadata !== 'string' || metadataRow.metadata.trim() === '') {
         console.warn(`Skipping metadata row due to missing, non-string, or empty metadata for token ${metadataRow.token_id || metadataRow.id || 'unknown'}`);
         continue; // Skip to next metadata row
      }

      let parsedMetadata: ParsedMetadata;
      try {
        parsedMetadata = JSON.parse(metadataRow.metadata);
        metadataTokenIdDecimal = parseInt(metadataRow.token_id, 16);

        if (isNaN(metadataTokenIdDecimal) || !parsedMetadata || !parsedMetadata.name) {
            console.warn(`Skipping metadata row after parse due to invalid/incomplete data for token ${metadataRow.token_id || metadataRow.id}`);
            continue; // Skip to next metadata row
        }
      } catch (parseError) {
          console.warn(`Skipping metadata row due to JSON parse error for token ${metadataRow.token_id || metadataRow.id}:`, parseError instanceof Error ? parseError.message : parseError);
          continue; // Skip to next metadata row
      }

      // --- Find Matching Owner Row (Inner Loop) --- 
      // Use the metadataTokenIdDecimal declared and assigned above
      const metadataTokenIdString = metadataRow.token_id; // Keep original hex string for potential logging
      // No need to re-parse or check isNaN for metadataTokenIdDecimal here, already done
      if (isNaN(metadataTokenIdDecimal)) { // Check if it was NaN from the start
          console.warn(`Skipping owner search because metadata token_id '${metadataTokenIdString}' was invalid.`);
          continue; // Skip to next metadata row if its own ID was invalid
      }
      
      for (const ownerRow of ownerSqlData) {
          try {
              const ownerTokenIdString = ownerRow.token_id; // Keep original hex string
              const ownerTokenIdDecimal = parseInt(ownerTokenIdString, 16);
              // Compare the parsed *decimal* numbers directly
              if (!isNaN(ownerTokenIdDecimal) && ownerTokenIdDecimal === metadataTokenIdDecimal) {
                  // Match found based on token_id
                  // Now check if the account_address is valid
                  if (ownerRow.account_address && ownerRow.account_address.trim() !== '') {
                      ownerAddress = ownerRow.account_address;
                      ownersFoundCount++;
                      // console.log(`Found owner ${ownerAddress} for token ${metadataTokenIdString}`); // Optional success log
                      break; // Stop searching for owners for this metadataRow
                  } else {
                      // Log if match found but address is invalid
                      console.warn(`Found owner row match for token ${metadataTokenIdString} (Decimal: ${metadataTokenIdDecimal}), but account_address is invalid:`, ownerRow);
                      // Don't break here, maybe another owner row for the same token ID is valid? (Unlikely but possible)
                  }
              }
          } catch (e) {
              // Log error parsing owner token ID during inner loop search
              console.warn(`Error processing owner token_id '${ownerRow.token_id}' while searching for match for metadata token ${metadataTokenIdString}:`, e);
          }
      }
      // --- End Inner Loop --- 

      // --- Construct Document and Prepare Operation --- 
      realmDocument = {
          realmId: metadataTokenIdDecimal,
          name: parsedMetadata.name,
          image: parsedMetadata.image,
          attributes: parsedMetadata.attributes,
          ...(ownerAddress && { seasonPassOwner: ownerAddress })
      };

      bulkOps.push({
          updateOne: {
              filter: { realmId: metadataTokenIdDecimal }, 
              update: { $set: realmDocument },   
              upsert: true                       
          }
      });

    }
    // --- End Outer Loop --- 
    const numOpsPrepared = bulkOps.length;
    console.log(`Prepared ${numOpsPrepared} upsert operations. Found owners for ${ownersFoundCount} realms.`);

    // --- 4. Connect to MongoDB and Execute Bulk Write --- 
    let bulkResultSummary = {};
    if (numOpsPrepared > 0) {
        console.log('Connecting to MongoDB...');
        await connectToDatabase();
        const db = await getDatabase();
        const collection = db.collection(REALMS_COLLECTION);

        console.log(`Executing bulkWrite operation on ${REALMS_COLLECTION}...`);
        const bulkResult = await collection.bulkWrite(bulkOps, { ordered: false }); 
        console.log('BulkWrite complete.');
        bulkResultSummary = {
            upsertedCount: bulkResult.upsertedCount,
            modifiedCount: bulkResult.modifiedCount,
            matchedCount: bulkResult.matchedCount,
        };
    } else {
         console.log('No valid operations prepared for bulkWrite.');
    }
    
    console.log('Realm data upsert process finished successfully.');

    return NextResponse.json({
      message: numOpsPrepared > 0 
          ? 'Realm data upsert process finished successfully.' 
          : 'Realm data refresh process finished. No valid realm data found to upsert.',
      realmsFetched: metadataSqlData.length,
      ownersFetched: ownerSqlData.length,
      ownersFound: ownersFoundCount,
      opsPrepared: numOpsPrepared,
      ...bulkResultSummary // Spread the bulkWrite result summary
    });

  } catch (error) {
    console.error('Unhandled error during realm data upsert POST request:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// Optional: Simple GET handler for testing endpoint existence
export async function GET() {
  return NextResponse.json({ message: "Realm data upsert endpoint. Use POST to trigger refresh." });
} 