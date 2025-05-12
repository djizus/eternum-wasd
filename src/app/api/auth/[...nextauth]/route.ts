import NextAuth, { /* type Account, type Profile, */ type User, type NextAuthOptions, type Session } from "next-auth";
import type { JWT } from "next-auth/jwt"; // Import JWT type for token augmentation
import DiscordProvider from "next-auth/providers/discord";
import { getDatabase } from "@/lib/mongodb"; // Added import for MongoDB
// import { type Db, type Collection } from 'mongodb'; // REMOVED unused MongoClient

// Augment NextAuth types
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user?: User & { // 'User' is still used here
      id?: string | null; // Allow id to be string or null
    };
  }
  // Removed duplicate User augmentation
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    userId?: string | null;
    userName?: string | null;
    userImage?: string | null;
  }
}

// REMOVED Unused DiscordUserDocument interface
// interface DiscordUserDocument {
//   ...
// }

// Define the structure of the Discord Guild object from their API
// interface DiscordGuild { // No longer needed as guild check is removed
//   id: string;
//   name: string;
//   icon: string | null;
//   owner: boolean;
//   permissions: string; // User\'s permissions in this guild
// }

// Define structure for Discord Channel object (partial)
// interface DiscordChannel {
//   id: string;
//   type: number;
//   guild_id?: string; // ID of the guild the channel is in (if it\'s a guild channel)
//   name?: string;
// }

// Define profile structure if extending Discord profile data
// interface DiscordProfile extends Profile {
//   // Add specific fields if needed, e.g.:
//   // username: string;
//   // discriminator: string;
//   // avatar: string | null;
//   // id: string;
// }

// Read target Guild ID and Channel ID from environment variables
// const TARGET_GUILD_ID = process.env.DISCORD_SERVER_ID; // No longer needed
// const TARGET_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID; // No longer needed for channel check
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_SECRET;
// const DISCORD_MEMBERS_ID_STRING = process.env.DISCORD_MEMBERS_ID; // No longer needed

// let ALLOWED_MEMBER_IDS: string[] = []; // No longer needed

// Ensure the environment variables are set
// if (!TARGET_GUILD_ID) { // No longer needed
//   throw new Error("Missing environment variable: DISCORD_SERVER_ID");
// }
if (!DISCORD_CLIENT_ID) {
  throw new Error("Missing environment variable: DISCORD_CLIENT_ID");
}
if (!DISCORD_CLIENT_SECRET) {
  throw new Error("Missing environment variable: DISCORD_CLIENT_SECRET");
}
// if (!DISCORD_MEMBERS_ID_STRING) { // No longer needed
//   throw new Error("Missing environment variable: DISCORD_MEMBERS_ID");
// } else {
//   try {
//     ALLOWED_MEMBER_IDS = JSON.parse(DISCORD_MEMBERS_ID_STRING);
//     if (!Array.isArray(ALLOWED_MEMBER_IDS) || !ALLOWED_MEMBER_IDS.every(id => typeof id === \'string\' || typeof id === \'number\')) {
//       throw new Error("DISCORD_MEMBERS_ID must be an array of strings or numbers.");
//     }
//     // Ensure all IDs are strings for consistent comparison
//     ALLOWED_MEMBER_IDS = ALLOWED_MEMBER_IDS.map(id => String(id));
//   } catch (e) {
//     console.error("Failed to parse DISCORD_MEMBERS_ID. Ensure it is a valid JSON array string (e.g., [\\\"id1\\\", \\\"id2\\\"])\", e);
//     throw new Error("Invalid format for DISCORD_MEMBERS_ID. Must be a JSON array of IDs.");
//   }
// }

// Define NextAuth options
const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify email guilds" } }, // Added email scope
    }),
    // Add other providers here if needed
  ],
  callbacks: {
    // Add types for parameters: User, Account, Profile (optional)
    async signIn({ user, account, email, credentials }) {
      console.log("signIn callback", { user, account, email, credentials });
      // Check if the user's address is in the guild members list
      if (!account || !account.providerAccountId) {
        console.error("Provider account ID is missing");
        return false; // Deny sign-in if address is missing
      }
      const userAddress = account.providerAccountId;
      
      try {
        const db = await getDatabase();
        const collection = db.collection('members');
        const member = await collection.findOne({ address: { $regex: new RegExp(`^${userAddress}$`, 'i') } });
        
        if (member) {
          console.log("Guild member verified:", userAddress);
          return true; // Allow sign-in
        } else {
          console.log("User is not a guild member:", userAddress);
          return '/unauthorized'; // Redirect non-members
        }
      } catch (error) {
        console.error("Error verifying guild member:", error);
        return false; // Deny sign-in on error
      }
    },
    async jwt({ token, user, account /*, profile */ }) { // Removed profile
      if (account && user) { 
        token.accessToken = account.access_token;
        token.userId = user.id; 
        token.userName = user.name;
        token.userImage = user.image; 
      }
      return token;
    },
    async session({ session, token }: { session: Session, token: JWT }) { 
      if (token.accessToken && session) {
        session.accessToken = token.accessToken;
      }
      if (token.userId && session.user) { 
        session.user.id = token.userId; 
      }
      if (token.userName && session.user) { 
        session.user.name = token.userName;
      }
      if (session.user) { 
        if (typeof token.userImage === 'string') {
          session.user.image = token.userImage;
        } else {
          session.user.image = null; 
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt", // Explicitly state JWT strategy
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  }
  // Other NextAuth config options (pages, secret, etc.) would go here
};

// Initialize NextAuth
const handler = NextAuth(authOptions);

// Explicitly export the GET and POST handlers for the route
export { handler as GET, handler as POST }; 