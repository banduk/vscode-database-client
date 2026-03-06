const fs = require("fs");
const path = require("path");

const testDir = __dirname;
const files = fs.readdirSync(testDir).filter((file) => file.endsWith(".test.js"));

if (files.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

for (const file of files) {
  require(path.join(testDir, file));
}
