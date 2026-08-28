import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration
const OLD_DB_IDS = [
  "(default)",
  "ai-studio-rssernews-e5e987df-61cc-46dc-8b18-cdc051dc3866",
  "ai-studio-e5e987df-61cc-46dc-8b18-cdc051dc3866"
];
const NEW_DB_ID = "rsser-final";
const PROJECT_ID = "gen-lang-client-0728647424";

async function migrate() {
  console.log("Starting migration...");
  
  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID });
  }
  
  const newDb = getFirestore(undefined as any, NEW_DB_ID);

  let sourceDb = null;
  let sourceDbId = "";

  for (const dbId of OLD_DB_IDS) {
    try {
      console.log(`Checking database: ${dbId}...`);
      const testDb = getFirestore(undefined as any, dbId === "(default)" ? undefined : dbId);
      // Try to get a count from users
      const snap = await testDb.collection("users").limit(1).get();
      if (!snap.empty) {
        console.log(`Found active data in database: ${dbId}`);
        sourceDb = testDb;
        sourceDbId = dbId;
        break;
      } else {
        console.log(`Database ${dbId} is empty or inaccessible.`);
      }
    } catch (e: any) {
      console.log(`Error accessing database ${dbId}: ${e.message}`);
    }
  }

  if (!sourceDb) {
    console.error("Could not find any source database with data to migrate.");
    return;
  }

  const collectionsToMigrate = [
    "users",
    "publicSources",
    "announcements",
    "messages",
    "publicRssCache"
  ];

  for (const colName of collectionsToMigrate) {
    console.log(`Migrating collection: ${colName} from ${sourceDbId}...`);
    const snapshot = await sourceDb.collection(colName).get();
    console.log(`Found ${snapshot.size} documents in ${colName}`);

    const batchSize = 400; // Firestore batch limit is 500
    let count = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      await newDb.collection(colName).doc(doc.id).set(data, { merge: true });
      
      // Also migrate sub-collections for users (feeds and blogs)
      if (colName === "users") {
        const subCols = ["feeds", "blogs"];
        for (const subCol of subCols) {
          const subSnap = await sourceDb.collection(colName).doc(doc.id).collection(subCol).get();
          if (!subSnap.empty) {
            console.log(`  Migrating ${subSnap.size} docs from users/${doc.id}/${subCol}...`);
            for (const subDoc of subSnap.docs) {
              await newDb.collection(colName).doc(doc.id).collection(subCol).doc(subDoc.id).set(subDoc.data(), { merge: true });
              
              // If it's a blog, migrate votes and comments
              if (subCol === "blogs") {
                const nestedCols = ["votes", "comments"];
                for (const nestedCol of nestedCols) {
                  const nestedSnap = await sourceDb.collection(colName).doc(doc.id).collection(subCol).doc(subDoc.id).collection(nestedCol).get();
                  if (!nestedSnap.empty) {
                    for (const nestedDoc of nestedSnap.docs) {
                       await newDb.collection(colName).doc(doc.id).collection(subCol).doc(subDoc.id).collection(nestedCol).doc(nestedDoc.id).set(nestedDoc.data(), { merge: true });
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      count++;
      if (count % 50 === 0) console.log(`  Progress: ${count}/${snapshot.size}`);
    }
    console.log(`Finished ${colName}.`);
  }

  console.log("Migration completed successfully!");
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
