// scripts/remove-bg-worker.cjs
const fs = require('fs');
const { removeBackground } = require('@imgly/background-removal-node');

async function main() {
  const [,, inputFile, outputFile] = process.argv;
  if (!inputFile || !outputFile) {
    console.error('Usage: node remove-bg-worker.cjs <inputPath> <outputPath>');
    process.exit(1);
  }

  const inBuf = fs.readFileSync(inputFile);
  const blob = new Blob([inBuf], { type: 'image/png' });
  const resultBlob = await removeBackground(blob);
  const arrayBuffer = await resultBlob.arrayBuffer();
  const outBuf = Buffer.from(arrayBuffer);
  fs.writeFileSync(outputFile, outBuf);
  console.log('OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
