import app from '../index';
import http from 'http';
import { closeDb } from '../db';

async function testHttpEndpoint() {
  console.log('Testing Express API Endpoint: GET /api/personal-model/overview...');
  
  const testPort = 3007;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => resolve());
  });

  try {
    const res = await fetch(`http://localhost:${testPort}/api/personal-model/overview?userId=user_ben`);
    const json = (await res.json()) as any;

    if (res.status === 200 && json.success === true && json.data.user.id === 'user_ben') {
      console.log('✓ PASS: GET /api/personal-model/overview returned HTTP 200 with valid overview payload:');
      console.log(`  User: ${json.data.user.display_name} (${json.data.user.id})`);
      console.log(`  Goals: ${json.data.goals.length}`);
      console.log(`  Outcomes: ${json.data.outcomes.length}`);
      console.log(`  Commitments: ${json.data.commitments.length}`);
      console.log(`  Rules: ${json.data.rules.length}`);
      console.log(`  Decisions: ${json.data.decisions.length}`);
    } else {
      console.error('✗ FAIL: Unexpected API response:', json);
      process.exit(1);
    }
  } catch (err) {
    console.error('✗ FAIL: Request failed:', err);
    process.exit(1);
  } finally {
    server.close();
    await closeDb();
    process.exit(0);
  }
}

testHttpEndpoint();
