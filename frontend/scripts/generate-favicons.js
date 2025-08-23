const { favicons } = require('favicons');
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '../public/images/favicon.png');
const dest = path.join(__dirname, '../public');

const configuration = {
  path: '/',
  appName: 'Zipsea',
  appShortName: 'Zipsea',
  appDescription: 'Find the best cruise deals',
  developerName: 'Zipsea',
  developerURL: null,
  background: '#5A4BDB',
  theme_color: '#5A4BDB',
  display: 'standalone',
  orientation: 'portrait',
  scope: '/',
  start_url: '/',
  preferRelatedApplications: false,
  relatedApplications: undefined,
  version: '1.0',
  logging: false,
  pixel_art: false,
  loadManifestWithCredentials: false,
  manifestMaskable: false,
  icons: {
    android: true,
    appleIcon: true,
    appleStartup: true,
    favicons: true,
    windows: true,
    yandex: false
  }
};

(async function() {
  try {
    const response = await favicons(source, configuration);
    
    // Write images to public directory
    await Promise.all(response.images.map(async (image) => {
      const filepath = path.join(dest, image.name);
      await fs.promises.writeFile(filepath, image.contents);
      console.log(`Generated: ${image.name}`);
    }));
    
    // Write files (manifest, etc.) to public directory
    await Promise.all(response.files.map(async (file) => {
      const filepath = path.join(dest, file.name);
      await fs.promises.writeFile(filepath, file.contents);
      console.log(`Generated: ${file.name}`);
    }));
    
    // Save HTML meta tags for reference
    const htmlPath = path.join(__dirname, '../favicon-meta-tags.html');
    await fs.promises.writeFile(htmlPath, response.html.join('\n'));
    console.log('Favicon generation complete!');
    console.log('HTML meta tags saved to favicon-meta-tags.html');
    
  } catch (error) {
    console.log('Error generating favicons:', error.message);
  }
})();