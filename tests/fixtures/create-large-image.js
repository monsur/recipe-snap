const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a 2000x2000 PNG image (solid color for testing resize)
function createLargePNG() {
  const width = 2000;
  const height = 2000;

  // PNG file signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);      // Width
  ihdr.writeUInt32BE(height, 4);     // Height
  ihdr.writeUInt8(8, 8);             // Bit depth
  ihdr.writeUInt8(2, 9);             // Color type (RGB)
  ihdr.writeUInt8(0, 10);            // Compression
  ihdr.writeUInt8(0, 11);            // Filter
  ihdr.writeUInt8(0, 12);            // Interlace

  // Create pixel data (RGB, blue image)
  const bytesPerPixel = 3;
  const bytesPerRow = width * bytesPerPixel + 1; // +1 for filter byte
  const pixelData = Buffer.alloc(height * bytesPerRow);

  for (let y = 0; y < height; y++) {
    const rowStart = y * bytesPerRow;
    pixelData[rowStart] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * bytesPerPixel;
      pixelData[pixelStart] = 0;     // R
      pixelData[pixelStart + 1] = 0; // G
      pixelData[pixelStart + 2] = 255; // B (blue)
    }
  }

  // Compress pixel data
  const compressed = zlib.deflateSync(pixelData);

  // Helper to create chunk
  function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuffer = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = require('zlib').crc32(crcData);
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);

    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
  }

  // Create PNG chunks
  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  // Combine all parts
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

console.log('Creating large test image (2000x2000)...');
const largePNG = createLargePNG();
fs.writeFileSync(path.join(__dirname, 'test-image-large.png'), largePNG);
console.log(`✓ Created test-image-large.png (${largePNG.length} bytes)`);
