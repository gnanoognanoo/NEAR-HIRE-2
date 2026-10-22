const { validateEnvironment } = require('./update-policy.cjs');
try { validateEnvironment(process.argv[2], process.env); console.log('Release environment: PASS'); }
catch (error) { console.error(error.message); process.exitCode = 1; }
