const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const images = [
  '05_dining_experience.jpg',
  '04_boarding_day.jpg',
  '01_cruise_ship_ocean_alt.jpg'
];

const inputDir = path.join(__dirname, '../public/images/cruise_images_curated');
const outputDir = path.join(__dirname, '../public/images/cruise_images_curated');

async function optimizeImage(filename) {
  const inputPath = path.join(inputDir, filename);
  const outputPath = path.join(outputDir, filename);
  const backupPath = path.join(outputDir, `${filename}.original`);

  // Get original file size
  const originalStats = fs.statSync(inputPath);
  const originalSize = (originalStats.size / 1024 / 1024).toFixed(2);

  // Create backup if it doesn't exist
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(inputPath, backupPath);
    console.log(`Created backup: ${backupPath}`);
  }

  try {
    // Optimize image
    await sharp(inputPath)
      .resize(1920, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toFile(`${outputPath}.temp`);

    // Replace original with optimized
    fs.renameSync(`${outputPath}.temp`, outputPath);

    // Get new file size
    const newStats = fs.statSync(outputPath);
    const newSize = (newStats.size / 1024 / 1024).toFixed(2);
    const reduction = ((1 - newStats.size / originalStats.size) * 100).toFixed(1);

    console.log(`✓ ${filename}: ${originalSize}MB → ${newSize}MB (-${reduction}%)`);
  } catch (error) {
    console.error(`✗ Error optimizing ${filename}:`, error.message);
  }
}

async function main() {
  console.log('Optimizing large images...\n');

  for (const image of images) {
    await optimizeImage(image);
  }

  console.log('\n✅ Image optimization complete!');
}

main().catch(console.error);
