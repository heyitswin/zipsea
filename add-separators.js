/**
 * Script to add alternating separators to first-time-cruisers-guide page
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/app/first-time-cruisers-guide/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Define the separators
const separator3 = `      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-3.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />`;

const separator10 = `      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-10.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />`;

// Replacements to make (alternating between separator-3 and separator-10)
const replacements = [
  // After Welcome Section (separator-10)
  {
    search: `      </div>\n\n      {/* Photo Placeholder */}\n      <div className="py-12">`,
    replace: `      </div>\n\n      {/* Separator 2 */}\n${separator10}\n\n      {/* Photo Placeholder */}\n      <div className="py-12">`
  },
  // After Photo Placeholder (separator-3)
  {
    search: `        </div>\n      </div>\n\n      {/* Table of Contents */}\n      <div className="bg-white py-16">`,
    replace: `        </div>\n      </div>\n\n      {/* Separator 3 */}\n${separator3}\n\n      {/* Table of Contents */}\n      <div className="bg-white py-16">`
  },
  // After Table of Contents (separator-10)
  {
    search: `          </div>\n        </div>\n      </div>\n\n      {/* Pre-Cruise Planning Section */}\n      <section id="pre-cruise-planning" className="py-16">`,
    replace: `          </div>\n        </div>\n      </div>\n\n      {/* Separator 4 */}\n${separator10}\n\n      {/* Pre-Cruise Planning Section */}\n      <section id="pre-cruise-planning" className="py-16">`
  },
  // After Pre-Cruise Planning (separator-3)
  {
    search: `      </section>\n\n      {/* FAQs Section Header */}`,
    replace: `      </section>\n\n      {/* Separator 5 */}\n${separator3}\n\n      {/* FAQs Section Header */}`
  },
  // After Packing Section (separator-10)
  {
    search: `      </section>\n\n      {/* Photo Break */}`,
    replace: `      </section>\n\n      {/* Separator 6 */}\n${separator10}\n\n      {/* Photo Break */}`
  },
  // After Embarkation Day (separator-3)
  {
    search: `      </section>\n\n      {/* Photo Gallery - Your First Day */}`,
    replace: `      </section>\n\n      {/* Separator 7 */}\n${separator3}\n\n      {/* Photo Gallery - Your First Day */}`
  },
  // After First Day Section (separator-10)
  {
    search: `      </section>\n\n      {/* Dining & Food Section */}\n      <section id="dining-food" className="py-16">`,
    replace: `      </section>\n\n      {/* Separator 8 */}\n${separator10}\n\n      {/* Dining & Food Section */}\n      <section id="dining-food" className="py-16">`
  },
  // After Dining Section (separator-3)
  {
    search: `      </section>\n\n      {/* Photo Break - Food */}`,
    replace: `      </section>\n\n      {/* Separator 9 */}\n${separator3}\n\n      {/* Photo Break - Food */}`
  },
  // After Entertainment Section (separator-10)
  {
    search: `      </section>\n\n      {/* Shore Excursions Section */}\n      <section id="shore-excursions" className="py-16">`,
    replace: `      </section>\n\n      {/* Separator 10 */}\n${separator10}\n\n      {/* Shore Excursions Section */}\n      <section id="shore-excursions" className="py-16">`
  },
  // After Shore Excursions (separator-3)
  {
    search: `      </section>\n\n      {/* Photo Break - Port */}`,
    replace: `      </section>\n\n      {/* Separator 11 */}\n${separator3}\n\n      {/* Photo Break - Port */}`
  },
  // After Money Matters (separator-10)
  {
    search: `      </section>\n\n      {/* Health & Safety Section */}\n      <section id="health-safety" className="py-16">`,
    replace: `      </section>\n\n      {/* Separator 12 */}\n${separator10}\n\n      {/* Health & Safety Section */}\n      <section id="health-safety" className="py-16">`
  },
  // After Health Section (separator-3)
  {
    search: `      </section>\n\n      {/* Photo Break - Wellness */}`,
    replace: `      </section>\n\n      {/* Separator 13 */}\n${separator3}\n\n      {/* Photo Break - Wellness */}`
  },
  // After Etiquette Section (separator-10)
  {
    search: `      </section>\n\n      {/* Disembarkation Section */}\n      <section id="disembarkation" className="py-16">`,
    replace: `      </section>\n\n      {/* Separator 14 */}\n${separator10}\n\n      {/* Disembarkation Section */}\n      <section id="disembarkation" className="py-16">`
  },
  // After Disembarkation (separator-3)
  {
    search: `      </section>\n\n      {/* Photo Break - Last Day */}`,
    replace: `      </section>\n\n      {/* Separator 15 */}\n${separator3}\n\n      {/* Photo Break - Last Day */}`
  },
  // After Insider Secrets (separator-10)
  {
    search: `      </section>\n\n      {/* CTA Section */}`,
    replace: `      </section>\n\n      {/* Separator 16 */}\n${separator10}\n\n      {/* CTA Section */}`
  }
];

// Apply replacements
replacements.forEach(({ search, replace }, index) => {
  if (content.includes(search)) {
    content = content.replace(search, replace);
    console.log(`✅ Applied separator ${index + 2}`);
  } else {
    console.log(`⚠️  Could not find pattern for separator ${index + 2}`);
  }
});

// Write the modified content back
fs.writeFileSync(filePath, content);
console.log('\n✅ Separators added successfully!');
