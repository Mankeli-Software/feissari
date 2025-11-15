import dotenv from 'dotenv';
import admin from 'firebase-admin';

// Load environment variables
dotenv.config();

// Initialize Firebase
const projectId = process.env.FIREBASE_PROJECT_ID;
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKey) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
  process.exit(1);
}

let serviceAccount: admin.ServiceAccount | undefined;
try {
  serviceAccount = JSON.parse(serviceAccountKey) as admin.ServiceAccount;
} catch (err) {
  const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf8');
  serviceAccount = JSON.parse(decoded) as admin.ServiceAccount;
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  projectId: (serviceAccount as any)?.project_id || projectId
});

const firestore = admin.firestore();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const INITIAL_BALANCE = 100;

async function testGameEnd() {
  console.log('🎮 Starting game end simulation...\n');

  // Step 1: Create a test user
  const testUserId = `test-user-${Date.now()}`;
  const testUserName = 'Test User';
  
  console.log('1️⃣ Creating test user...');
  await firestore.collection('users').doc(testUserId).set({
    name: testUserName,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`   ✅ User created: ${testUserName} (${testUserId})\n`);

  // Step 2: Create a game via API
  console.log('2️⃣ Creating game via API...');
  const createGameResponse = await fetch(`${BACKEND_URL}/api/game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: testUserId })
  });

  if (!createGameResponse.ok) {
    console.error('   ❌ Failed to create game:', await createGameResponse.text());
    process.exit(1);
  }

  const gameData = await createGameResponse.json() as { gameId: string; createdAt: string; initialBalance: number };
  const gameId = gameData.gameId;
  console.log(`   ✅ Game created: ${gameId}\n`);

  // Step 3: Send initial message to get game started
  console.log('3️⃣ Getting initial AI message...');
  const initialResponse = await fetch(`${BACKEND_URL}/api/game/${gameId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: null })
  });

  if (!initialResponse.ok) {
    console.error('   ❌ Failed to get initial message:', await initialResponse.text());
    process.exit(1);
  }

  const initialData = await initialResponse.json() as any;
  console.log(`   ✅ Initial balance: €${initialData.balance}`);
  console.log(`   ✅ Feissari: ${initialData.feissariName}\n`);

  // Step 4: Simulate some gameplay with defeated feissari
  console.log('4️⃣ Simulating gameplay with defeated feissari...');
  
  // Add some chat history entries with movedToNext: true to simulate defeated feissari
  const chatHistoryRef = firestore.collection('chatHistory').doc(gameId).collection('chats');
  
  // Simulate defeating 3 feissari
  for (let i = 0; i < 3; i++) {
    await chatHistoryRef.add({
      feissariId: `feissari-${i}`,
      feissariName: `Test Feissari ${i + 1}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userMessage: 'Test message',
      aiMessage: 'Test response',
      balanceBefore: INITIAL_BALANCE - (i * 10),
      balanceAfter: INITIAL_BALANCE - ((i + 1) * 10),
      emoteAssets: [],
      movedToNext: true // This marks the feissari as defeated
    });
  }

  // Add one more chat entry without movedToNext (current feissari)
  await chatHistoryRef.add({
    feissariId: 'feissari-current',
    feissariName: 'Current Feissari',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    userMessage: 'Current chat',
    aiMessage: 'Current response',
    balanceBefore: 70,
    balanceAfter: 65,
    emoteAssets: [],
    movedToNext: false
  });

  console.log(`   ✅ Simulated 3 defeated feissari\n`);

  // Step 5: Manually set the game creation time to 3+ minutes ago to trigger time expiration
  console.log('5️⃣ Setting game creation time to 3+ minutes ago...');
  const threeMinutesAgo = new Date(Date.now() - (3 * 60 * 1000 + 5000)); // 3 minutes and 5 seconds ago
  await firestore.collection('games').doc(gameId).update({
    createdAt: admin.firestore.Timestamp.fromDate(threeMinutesAgo)
  });
  console.log(`   ✅ Game time set to expire\n`);

  // Step 6: Send a message to trigger time expiration check
  console.log('6️⃣ Sending message to trigger time expiration...');
  const finalResponse = await fetch(`${BACKEND_URL}/api/game/${gameId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: null })
  });

  if (!finalResponse.ok) {
    console.error(`   ❌ Request failed with status ${finalResponse.status}`);
    const errorText = await finalResponse.text();
    console.error('   Error:', errorText);
  } else {
    const finalData = await finalResponse.json() as any;
    console.log('   ✅ Response received:');
    console.log(`      Game Over: ${finalData.gameOver}`);
    console.log(`      Final Balance: €${finalData.balance}`);
    console.log(`      Defeated Feissari: ${finalData.defeatedFeissari}`);
    console.log(`      Score: ${finalData.score}`);
    console.log(`      Expected Score: ${finalData.defeatedFeissari * finalData.balance} (${finalData.defeatedFeissari} × ${finalData.balance})`);
  }

  console.log('\n7️⃣ Checking leaderboard entry...');
  const leaderboardSnapshot = await firestore
    .collection('leaderboard')
    .where('gameId', '==', gameId)
    .get();

  if (leaderboardSnapshot.empty) {
    console.log('   ❌ No leaderboard entry found!');
  } else {
    const entry = leaderboardSnapshot.docs[0].data();
    console.log('   ✅ Leaderboard entry found:');
    console.log(`      Score: ${entry.score}`);
    console.log(`      Defeated Feissari: ${entry.defeatedFeissari}`);
    console.log(`      Final Balance: €${entry.finalBalance}`);
  }

  console.log('\n✨ Test complete!\n');
  process.exit(0);
}

// Run the test
testGameEnd().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
