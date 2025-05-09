import NextAuth, { type Account, type Profile, type User, type NextAuthOptions, type Session } from "next-auth";
import type { JWT } from "next-auth/jwt"; // Import JWT type for token augmentation
import DiscordProvider from "next-auth/providers/discord";
import { getDatabase } from "@/lib/mongodb"; // Added import for MongoDB
import { type Db, type Collection } from 'mongodb'; // Removed unused MongoClient

// Augment NextAuth types
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user?: User & {
      id?: string | null; // Allow id to be string or null
    };
  }
  interface User {
    id?: string | null; // Add id to the default User type
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    userId?: string | null;
    userName?: string | null;
    userImage?: string | null;
  }
}

// Define the structure for the user document in MongoDB
interface DiscordUserDocument {
  discord_id: string;
  username?: string | null;
  email?: string | null;
  image?: string | null;
  profile?: Profile | null; // Store the raw Discord profile
  first_login_at: Date;
  last_login_at: Date;
  login_history: Array<{
    timestamp: Date;
    account_details: Partial<Account> | null; // Use Partial<Account> instead of any
  }>;
  // Add any other fields you want to track
}

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
    async signIn({ user, account, profile }: { user: User, account: Account | null, profile?: Profile | undefined }) {
      if (account?.provider === "discord" && user?.id) {
        console.log("Discord sign-in attempt for user:", user.name, user.id, user.email);

        // Log user information to MongoDB
        try {
          const db: Db = await getDatabase(); // Specify Db type
          const usersCollection: Collection<DiscordUserDocument> = db.collection<DiscordUserDocument>("discord_users");
          
          const currentDate = new Date();

          await usersCollection.updateOne(
            { discord_id: user.id },
            { 
              $set: { 
                username: user.name,
                email: user.email, // Make sure email scope is requested
                image: user.image,
                profile: profile, 
                last_login_at: currentDate
              },
              $push: { 
                login_history: { 
                  $each: [{ timestamp: currentDate, account_details: account ? { ...account } : null  }], // Spread account to ensure it's a plain object if not null
                  $slice: -10 
                } // Removed the 'as any' here, relying on correct typing of DiscordUserDocument
              },
              $setOnInsert: { discord_id: user.id, first_login_at: currentDate } 
            },
            { upsert: true }
          );
          console.log(`User ${user.id} (${user.name}) data logged/updated in MongoDB.`);
        } catch (error) {
          console.error("Error logging Discord user to MongoDB:", error);
          // Decide if this should prevent login. For now, we allow login even if DB log fails.
        }

        // Removed guild check and DISCORD_MEMBERS_ID check.
        // Anyone who successfully authenticates with Discord is allowed.
        console.log(`User ${user.id} (${user.name}) authenticated with Discord. Allowing sign in.`);
        return true;

      }
      // If not Discord provider or some preliminary issue, default to deny.
      console.log(`Sign-in attempt not processed by Discord check (provider: ${account?.provider}). Denying.`);
      return false;
    },
    async jwt({ token, user, account, profile }) {
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