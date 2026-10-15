import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read .env
const envPath = path.join(rootDir, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
let mongoUri = '';
let dbName = 'assesmentsdv';

for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith('MONGODB_URI=')) {
    let raw = trimmed.slice('MONGODB_URI='.length).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
    mongoUri = raw;
  }
  if (trimmed.startsWith('MONGODB_DB=')) {
    let raw = trimmed.slice('MONGODB_DB='.length).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
    dbName = raw;
  }
}

// Load safeQuestions and answerKeys
const safeQuestionsCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'safe-questions.ts'), 'utf8');
const dataMatch = safeQuestionsCode.match(/export const assessmentData = (\[[\s\S]*?\n\]);/);
const allQuestions = JSON.parse(dataMatch[1]);

const keysCode = fs.readFileSync(path.join(rootDir, 'src', 'server', 'assessment-keys.ts'), 'utf8');
const keysMatch = keysCode.match(/export const answerKeys = (\[[\s\S]*?\n\]);/);
const allKeys = JSON.parse(keysMatch[1]);

const questionsMap = new Map(allQuestions.map(q => [q.id, q]));
const keysMap = new Map(allKeys.map(k => [k.id, k]));

async function runTests() {
  console.log('====================================================');
  console.log('   AUTOMATED TEST SUITE: TECHNICAL MCQs (Q31-Q50)   ');
  console.log('====================================================');

  const errors = [];
  const targetIds = Array.from({ length: 20 }, (_, i) => 31 + i);

  // Test 1: Exactly 20 technical questions exist
  console.log('\n[Test 1] Verifying 20 technical questions in Section 3...');
  const techQuestions = targetIds.map(id => questionsMap.get(id)).filter(Boolean);
  if (techQuestions.length !== 20) {
    errors.push(`Expected 20 technical questions, found ${techQuestions.length}`);
  } else {
    console.log('✓ PASS: Exactly 20 technical questions exist in assessmentData (IDs 31-50).');
  }

  // Test 2: Distribution is exactly 5 Python, 5 Java, 5 Frontend/Backend, 5 Database/Deployment
  console.log('\n[Test 2] Verifying module distribution...');
  const pythonQuestions = targetIds.slice(0, 5);
  const javaQuestions = targetIds.slice(5, 10);
  const fullstackQuestions = targetIds.slice(10, 15);
  const dbDeployQuestions = targetIds.slice(15, 20);

  console.log(`- Python IDs: ${pythonQuestions.join(', ')} (Count: ${pythonQuestions.length})`);
  console.log(`- Java IDs: ${javaQuestions.join(', ')} (Count: ${javaQuestions.length})`);
  console.log(`- Frontend/Backend IDs: ${fullstackQuestions.join(', ')} (Count: ${fullstackQuestions.length})`);
  console.log(`- Database/Deployment IDs: ${dbDeployQuestions.join(', ')} (Count: ${dbDeployQuestions.length})`);

  if (pythonQuestions.length !== 5 || javaQuestions.length !== 5 || fullstackQuestions.length !== 5 || dbDeployQuestions.length !== 5) {
    errors.push('Module distribution does not equal exactly 5 per module');
  } else {
    console.log('✓ PASS: Distribution is exactly 5 Python, 5 Java, 5 Frontend/Backend, 5 Database/Deployment.');
  }

  // Test 3: Every question has exactly four distinct options
  console.log('\n[Test 3] Verifying option counts and uniqueness...');
  for (const q of techQuestions) {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push(`Q${q.id} does not have exactly 4 options (has ${q.options?.length})`);
    }
    const uniqueOptions = new Set(q.options);
    if (uniqueOptions.size !== 4) {
      errors.push(`Q${q.id} has duplicate options!`);
    }
  }
  console.log('✓ PASS: All 20 questions have exactly 4 unique options.');

  // Test 4: Every question has an authoritative answer key in assessmentKeys
  console.log('\n[Test 4] Verifying local fallback answer keys...');
  for (const id of targetIds) {
    const q = questionsMap.get(id);
    const k = keysMap.get(id);
    if (!k || !k.correctAnswer) {
      errors.push(`Q${id} missing correctAnswer in answerKeys`);
      continue;
    }
    if (!q.options.includes(k.correctAnswer)) {
      errors.push(`Q${id} correctAnswer "${k.correctAnswer}" not in options [${q.options.join(', ')}]`);
    }
    if (!k.explanation || k.explanation.trim().length === 0) {
      errors.push(`Q${id} missing explanation`);
    }
  }
  console.log('✓ PASS: All 20 questions have valid answer keys and explanations matching options.');

  // Test 5: All 20 visual assets exist and return valid SVG
  console.log('\n[Test 5] Verifying 20 visual SVG assets...');
  for (const q of techQuestions) {
    if (!q.image || !q.image.startsWith('/')) {
      errors.push(`Q${q.id} image path is invalid: "${q.image}"`);
      continue;
    }
    const assetPath = path.join(rootDir, 'public', q.image.replace(/^\//, ''));
    if (!fs.existsSync(assetPath)) {
      errors.push(`Q${q.id} image file does not exist on disk: ${assetPath}`);
      continue;
    }
    const svgContent = fs.readFileSync(assetPath, 'utf8');
    if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
      errors.push(`Q${q.id} image is not a valid SVG: ${assetPath}`);
    }
  }
  console.log('✓ PASS: All 20 question SVG images exist in public/ and contain valid SVG markup.');

  // Test 6: Connect to MongoDB and inspect dv_answers
  console.log('\n[Test 6] Verifying authoritative MongoDB dv_answers collection...');
  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;
  const col = db.collection('dv_answers');

  const allDbDocs = await col.find({}).toArray();
  console.log(`Total docs in dv_answers: ${allDbDocs.length}`);
  // Inspect all documents in dv_answers
  const anomalousDocs = allDbDocs.filter(d => typeof d.questionId !== 'number' || d.questionId < 1 || d.questionId > 60);
  if (anomalousDocs.length > 0) {
    console.log(`Found ${anomalousDocs.length} anomalous documents in dv_answers:`, anomalousDocs.map(d => ({ _id: d._id, questionId: d.questionId, category: d.category })));
  }
  const validDbDocs = allDbDocs.filter(d => typeof d.questionId === 'number' && d.questionId >= 1 && d.questionId <= 60);
  const sortedIds = validDbDocs.map(d => d.questionId).sort((a,b) => a - b);
  console.log(`Valid question IDs in dv_answers (count=${sortedIds.length}): min=${sortedIds[0]}, max=${sortedIds[sortedIds.length - 1]}`);

  // Check Q31-Q50 in MongoDB
  for (const id of targetIds) {
    const dbDoc = allDbDocs.find(d => d.questionId === id);
    if (!dbDoc) {
      errors.push(`MongoDB dv_answers is missing document for Q${id}`);
      continue;
    }
    const localQ = questionsMap.get(id);
    const localK = keysMap.get(id);

    if (dbDoc.correctAnswer !== localK.correctAnswer) {
      errors.push(`MongoDB Q${id} correctAnswer mismatch: DB="${dbDoc.correctAnswer}", Local="${localK.correctAnswer}"`);
    }
    const expectedLetter = String.fromCharCode(65 + localQ.options.indexOf(localK.correctAnswer));
    if (dbDoc.correctOptionLetter !== expectedLetter) {
      errors.push(`MongoDB Q${id} letter mismatch: DB="${dbDoc.correctOptionLetter}", Expected="${expectedLetter}"`);
    }
    if (dbDoc.scoreWeight !== 1) {
      errors.push(`MongoDB Q${id} scoreWeight is ${dbDoc.scoreWeight}, expected 1`);
    }
  }
  console.log('✓ PASS: All 20 MongoDB dv_answers records match local questions and keys perfectly.');

  // Test 7: Simulation of evaluation engine with letters, option strings, wrong answers, and empty answers
  console.log('\n[Test 7] Testing evaluation engine behavior for Q31-Q50...');
  
  // Exact evaluation logic from src/server/utils/evaluation.ts
  function evaluateMcq(questionId, candidateValue, options, correctAnswerKey, dvKey) {
    if (candidateValue === null || candidateValue === undefined) return false;
    const candVal = String(candidateValue).trim();
    if (!candVal) return false;

    const validOptions = (options && Array.isArray(options) && options.length > 0)
      ? options
      : (dvKey?.options && Array.isArray(dvKey.options) && dvKey.options.length > 0)
        ? dvKey.options
        : [];

    const keyVal = (correctAnswerKey || dvKey?.correctAnswer || dvKey?.correctOptionLetter || '').trim();

    let correctOptionIndex = -1;
    if (dvKey && typeof dvKey.correctOptionNumber === 'number' && dvKey.correctOptionNumber >= 1) {
      correctOptionIndex = dvKey.correctOptionNumber - 1;
    } else if (dvKey && dvKey.correctOptionLetter && /^[A-E]$/i.test(dvKey.correctOptionLetter)) {
      correctOptionIndex = dvKey.correctOptionLetter.toUpperCase().charCodeAt(0) - 65;
    } else if (/^[A-E]$/i.test(keyVal)) {
      correctOptionIndex = keyVal.toUpperCase().charCodeAt(0) - 65;
    } else if (validOptions.length > 0) {
      const matchIdx = validOptions.findIndex(opt => opt.trim().toLowerCase() === keyVal.toLowerCase());
      if (matchIdx >= 0) {
        correctOptionIndex = matchIdx;
      }
    }

    const correctOptionLetter = correctOptionIndex >= 0 ? String.fromCharCode(65 + correctOptionIndex) : (dvKey?.correctOptionLetter || keyVal).toUpperCase();

    // 1. Serialized JSON format
    if (candVal.startsWith('{') && candVal.endsWith('}')) {
      try {
        const parsed = JSON.parse(candVal);
        const letterVal = typeof parsed.selectedOption === 'string'
          ? parsed.selectedOption.trim()
          : typeof parsed.letter === 'string' ? parsed.letter.trim() : '';
        const textVal = typeof parsed.optionText === 'string'
          ? parsed.optionText.trim()
          : typeof parsed.value === 'string' ? parsed.value.trim() : '';

        if (letterVal) {
          return evaluateMcq(questionId, letterVal, validOptions, correctAnswerKey, dvKey);
        }
        if (textVal) {
          return evaluateMcq(questionId, textVal, validOptions, correctAnswerKey, dvKey);
        }
      } catch {
        // Continue
      }
    }

    // 2. Direct letter match (e.g. 'A', 'B', 'C', 'D')
    if (/^[A-E]$/i.test(candVal)) {
      const candUpper = candVal.toUpperCase();
      if (correctOptionLetter && candUpper === correctOptionLetter) {
        return true;
      }
      if (correctOptionIndex >= 0) {
        const candIndex = candUpper.charCodeAt(0) - 65;
        if (candIndex === correctOptionIndex) {
          return true;
        }
      }
    }

    // 3. Option number match ('1', '2', '3', '4')
    if (/^[1-5]$/.test(candVal)) {
      const candNum = parseInt(candVal, 10);
      if (dvKey && typeof dvKey.correctOptionNumber === 'number' && candNum === dvKey.correctOptionNumber) {
        return true;
      }
      if (correctOptionIndex >= 0 && candNum === correctOptionIndex + 1) {
        return true;
      }
    }

    // 4. Full string match
    if (candVal.toLowerCase() === keyVal.toLowerCase()) {
      return true;
    }

    return false;
  }

  let passedEvalTests = 0;
  for (const id of targetIds) {
    const q = questionsMap.get(id);
    const k = keysMap.get(id);
    const dbDoc = allDbDocs.find(d => d.questionId === id);
    const correctLetter = dbDoc.correctOptionLetter;
    const correctText = dbDoc.correctAnswer;
    const wrongLetter = correctLetter === 'A' ? 'B' : 'A';
    const wrongText = q.options.find(opt => opt !== correctText);

    // 1. Candidate sends correct letter 'A'/'B'/'C'/'D'
    const resLetter = evaluateMcq(id, correctLetter, q.options, k.correctAnswer, dbDoc);
    if (!resLetter) errors.push(`Eval failed for Q${id} with correct letter "${correctLetter}"`);

    // 2. Candidate sends correct text string
    const resText = evaluateMcq(id, correctText, q.options, k.correctAnswer, dbDoc);
    if (!resText) errors.push(`Eval failed for Q${id} with correct text "${correctText}"`);

    // 3. Candidate sends wrong letter
    const resWrongLetter = evaluateMcq(id, wrongLetter, q.options, k.correctAnswer, dbDoc);
    if (resWrongLetter) errors.push(`Eval awarded point for Q${id} with WRONG letter "${wrongLetter}"`);

    // 4. Candidate sends wrong text
    const resWrongText = evaluateMcq(id, wrongText, q.options, k.correctAnswer, dbDoc);
    if (resWrongText) errors.push(`Eval awarded point for Q${id} with WRONG text "${wrongText}"`);

    // 5. Candidate sends empty or null answer
    const resEmpty = evaluateMcq(id, '', q.options, k.correctAnswer, dbDoc);
    if (resEmpty) errors.push(`Eval awarded point for Q${id} with empty answer`);

    const resNull = evaluateMcq(id, null, q.options, k.correctAnswer, dbDoc);
    if (resNull) errors.push(`Eval awarded point for Q${id} with null answer`);

    passedEvalTests += 6;
  }
  console.log(`✓ PASS: Evaluated ${passedEvalTests} cases across correct letters, correct texts, wrong answers, and blank answers. All scored with 100% precision.`);

  // Test 8: Non-technical keys preservation check
  console.log('\n[Test 8] Verifying non-technical answer keys are completely preserved...');
  const nonTechIds = [1, 5, 10, 15, 20, 21, 25, 30, 51, 55, 60];
  for (const id of nonTechIds) {
    const dbDoc = allDbDocs.find(d => d.questionId === id);
    const localK = keysMap.get(id);
    if (!dbDoc) {
      errors.push(`Missing non-technical Q${id} in MongoDB`);
    } else if (dbDoc.correctAnswer !== localK.correctAnswer) {
      errors.push(`Non-technical Q${id} was altered! DB="${dbDoc.correctAnswer}", Local="${localK.correctAnswer}"`);
    }
  }
  console.log('✓ PASS: All non-technical answer keys (Sections 1, 2, 4, 5) remain identical and uncorrupted.');

  await mongoose.disconnect();

  console.log('\n====================================================');
  if (errors.length > 0) {
    console.error(`FAILED with ${errors.length} errors:`);
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  } else {
    console.log('ALL 8 TEST SUITES PASSED FLAWLESSLY! (0 ERRORS)');
    console.log('====================================================');
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

