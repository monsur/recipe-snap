const fs = require('fs');
const path = require('path');

// Create a minimal 100x100 PNG (red square)
function createSmallPNG() {
  // Minimal PNG: 100x100 red square
  const data = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000640000006408020000006c5d07' +
    '030000000467414d410000b18f0bfc6105000000097048597300000ec400000ec4' +
    '01952b0e1b00000003744558747469746c650054657374496d61676500d2e86e23' +
    '00000012494441546843eddd310100000802200d5dffffc8090000003c000128f4' +
    '6601010000005a0000000049454e44ae426082',
    'hex'
  );
  return data;
}

// Create a large 2000x2000 PNG (blue square) for resize testing
function createLargePNG() {
  // This creates a larger PNG that will need resizing
  // For simplicity, using a more complete PNG structure
  const Canvas = require('canvas');
  const canvas = Canvas.createCanvas(2000, 2000);
  const ctx = canvas.getContext('2d');

  // Fill with blue
  ctx.fillStyle = '#0000FF';
  ctx.fillRect(0, 0, 2000, 2000);

  // Add some text to make it identifiable
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '100px Arial';
  ctx.fillText('Test Large Image', 600, 1000);

  return canvas.toBuffer('image/png');
}

// Try to create images with canvas, fallback to minimal PNG
try {
  const Canvas = require('canvas');
  console.log('Using canvas to create test images...');

  // Small image (100x100)
  const smallCanvas = Canvas.createCanvas(100, 100);
  const smallCtx = smallCanvas.getContext('2d');
  smallCtx.fillStyle = '#FF0000';
  smallCtx.fillRect(0, 0, 100, 100);
  smallCtx.fillStyle = '#FFFFFF';
  smallCtx.font = '20px Arial';
  smallCtx.fillText('Test', 30, 55);
  fs.writeFileSync(path.join(__dirname, 'test-image-small.png'), smallCanvas.toBuffer('image/png'));
  console.log('✓ Created test-image-small.png (100x100)');

  // Large image (2000x2000)
  const largeBuffer = createLargePNG();
  fs.writeFileSync(path.join(__dirname, 'test-image-large.png'), largeBuffer);
  console.log('✓ Created test-image-large.png (2000x2000)');

} catch (err) {
  console.log('Canvas not available, creating minimal PNG...');
  // Fallback: create minimal PNG without canvas
  const smallPNG = createSmallPNG();
  fs.writeFileSync(path.join(__dirname, 'test-image-small.png'), smallPNG);
  console.log('✓ Created test-image-small.png (minimal)');
  console.log('Note: Install canvas for better test images: npm install canvas');
}
