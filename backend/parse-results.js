const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('./test-results.json', 'utf8'));
  const failures = [];
  
  data.testResults.forEach(suite => {
    suite.assertionResults.forEach(t => {
      if (t.status === 'failed') {
        const title = t.ancestorTitles.join(' > ') + ' > ' + t.title;
        const msg = t.failureMessages[0].replace(/\u001b\[.*?m/g, ''); // strip colors
        failures.push(`=== ${title} ===\n${msg.trim()}\n\n`);
      }
    });
  });

  fs.writeFileSync('./parsed-failures.txt', failures.join(''));
} catch (e) {
  console.error(e);
}
