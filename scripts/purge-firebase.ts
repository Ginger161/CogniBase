import fs from 'fs';
import path from 'path';

function replaceInFile(filePath: string, replacements: Array<{search: RegExp | string, replace: string}>) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return;
    let content = fs.readFileSync(fullPath, 'utf8');
    for (const r of replacements) {
        content = content.replace(r.search, r.replace);
    }
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${filePath}`);
}

// 2. VAULT
replaceInFile('app/(app)/vault/page.tsx', [
    { search: /import { auth, db } from '\.\.\/\.\.\/\.\.\/lib\/firebase';\n/g, replace: '' },
    { search: /import { onAuthStateChanged } from 'firebase\/auth';\n/g, replace: '' },
    { search: /import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, deleteDoc } from 'firebase\/firestore';\n/g, replace: '' },
    { 
      search: /const vq = query\(collection\(db, 'vault_files'\), where\('userId', '==', context\.uid\)\);\n\s+const vaultSnap = await getDocs\(vq\);\n\s+const vFiles = vaultSnap\.docs\.map\(d => \(\{\ id: d\.id, \.\.\.d\.data\(\) \}\)\);/g, 
      replace: `const res = await fetch('/api/documents');\n        const vFiles = await res.json();` 
    },
    { 
      search: /const sq = query\(collection\(db, 'study_guides'\), where\('userId', '==', context\.uid\)\);\n\s+const studyGuideSnap = await getDocs\(sq\);\n\s+const sGuides = studyGuideSnap\.docs\.map\(d => \(\{\ id: d\.id, \.\.\.d\.data\(\) \}\)\);/g, 
      replace: `const resSq = await fetch('/api/study-guides?userId=' + context.uid);\n        const sGuides = await resSq.json();` 
    },
    {
      search: /const q = query\(collection\(db, 'vault_files'\), where\('userId', '==', userData\.uid\)\);\n\s+const querySnapshot = await getDocs\(q\);\n\s+const existingFiles = querySnapshot\.docs\.map\(doc => doc\.data\(\)\);/g,
      replace: `const res = await fetch('/api/documents');\n      const existingFiles = await res.json();`
    },
    {
      search: /await addDoc\(collection\(db, 'vault_files'\), \{\n\s+userId: userData\.uid,\n\s+fileName: fileRes\.name,\n\s+fileSize: fileRes\.size,\n\s+downloadURL: fileRes\.url,\n\s+uploadedAt: serverTimestamp\(\),\n\s+status: 'raw'\n\s+\}\);/g,
      replace: `await fetch('/api/documents', {\n              method: 'POST',\n              headers: { 'Content-Type': 'application/json' },\n              body: JSON.stringify({\n                name: fileRes.name,\n                url: fileRes.url\n              })\n            });`
    },
    {
      search: /const deletePromises = selectedMaterials\.map\(id => deleteDoc\(doc\(db, 'vault_files', id\)\)\);/g,
      replace: `const deletePromises = selectedMaterials.map(id => fetch('/api/documents?id=' + id, { method: 'DELETE' }));`
    },
    {
      search: /await deleteDoc\(doc\(db, 'vault_files', id\)\);/g,
      replace: `await fetch('/api/documents?id=' + id, { method: 'DELETE' });`
    },
    {
      search: /const docRef = await addDoc\(collection\(db, 'study_guides'\), newGuide\);\n\n\s+const fullGuide = \{\ id: docRef\.id, \.\.\.newGuide, createdAt: \{\ seconds: Math\.floor\(Date\.now\(\) \/ 1000\) \}\ \};/g,
      replace: `const docRef = await fetch('/api/study-guides', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(newGuide)\n      });\n      const fullGuide = await docRef.json();`
    }
]);

// 3. STUDY GUIDES
replaceInFile('app/(app)/study-guides/page.tsx', [
    { search: /import { auth, db } from '\.\.\/\.\.\/\.\.\/lib\/firebase';\n/g, replace: '' },
    { search: /import { onAuthStateChanged } from 'firebase\/auth';\n/g, replace: '' },
    { search: /import { collection, getDocs, query, where } from 'firebase\/firestore';\n/g, replace: '' },
    {
      search: /const unsubscribe = onAuthStateChanged\(auth, async \(user\) => \{\n\s+if \(user\) \{\n\s+setUserData\(\{ name: user\.displayName \|\| 'Student', email: user\.email \|\| '', uid: user\.uid \}\);\n\s+try \{\n\s+const sq = query\(collection\(db, 'study_guides'\), where\('userId', '==', user\.uid\)\);\n\s+const studyGuideSnap = await getDocs\(sq\);\n\s+const sGuides = studyGuideSnap\.docs\.map\(d => \(\{\ id: d\.id, \.\.\.d\.data\(\) \}\)\);\n\s+sGuides\.sort\(\(a: any, b: any\) => \(b\.createdAt\?\.seconds \|\| 0\) - \(a\.createdAt\?\.seconds \|\| 0\)\);\n\s+setStudyGuides\(sGuides\);\n\s+\} catch\(e\) \{ console\.error\(e\) \}\n\s+\} else \{\n\s+setUserData\(\{ name: 'Guest Student', email: 'Not signed in', uid: '', profile: null \}\);\n\s+\}\n\s+\}\);\n\s+return \(\) => unsubscribe\(\);/g,
      replace: `const fetchGuides = async () => {\n      const { data: { session } } = await import('@/utils/supabase/client').then(m => m.supabase.auth.getSession());\n      if (session?.user) {\n        setUserData({ name: session.user.email?.split('@')[0] || 'Student', email: session.user.email || '', uid: session.user.id });\n        try {\n          const res = await fetch('/api/study-guides?userId=' + session.user.id);\n          const sGuides = await res.json();\n          setStudyGuides(sGuides);\n        } catch(e) { console.error(e) }\n      }\n    };\n    fetchGuides();`
    }
]);

console.log("Done purging Firebase.");
