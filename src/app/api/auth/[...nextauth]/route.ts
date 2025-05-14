import NextAuth, { /* type Account, type Profile, */ type User, type NextAuthOptions, type Session } from "next-auth";
import type { JWT } from "next-auth/jwt"; // Import JWT type for token augmentation
import DiscordProvider from "next-auth/providers/discord";
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

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_SECRET;

if (!DISCORD_CLIENT_ID) {
  throw new Error("Missing environment variable: DISCORD_CLIENT_ID");
}
if (!DISCORD_CLIENT_SECRET) {
  throw new Error("Missing environment variable: DISCORD_CLIENT_SECRET");
}

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
      console.log("Guild member verified:", userAddress);
      return true; // Allow sign-in

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