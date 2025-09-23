/**
 * Cruise category definitions and mappings for SEO-friendly URLs
 */

export interface CategoryConfig {
  slug: string;
  name: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  description: string; // SEO content
  filters: {
    regionId?: number | number[];
    cruiseLineId?: number | number[];
    departurePortId?: number | number[];
    minNights?: number;
    maxNights?: number;
    maxPrice?: number;
  };
  priority?: number; // For sitemap
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  keywords?: string[];
  faqItems?: Array<{
    question: string;
    answer: string;
  }>;
}

// Primary destination categories
export const destinationCategories: CategoryConfig[] = [
  {
    slug: 'caribbean',
    name: 'Caribbean',
    title: 'Caribbean Cruises',
    metaTitle: 'Caribbean Cruises 2025-2026 | Best Deals with Maximum Onboard Credit',
    metaDescription: 'Find the best Caribbean cruise deals with maximum onboard credit. Compare prices from all major cruise lines. Eastern, Western, and Southern Caribbean routes available.',
    h1: 'Caribbean Cruises - Best Deals & Maximum Onboard Credit',
    description: `Discover the ultimate Caribbean cruise vacation with crystal-clear waters, pristine beaches, and vibrant island cultures.
    Our Caribbean cruises visit popular ports like Cozumel, Jamaica, Grand Cayman, and the Bahamas. Whether you prefer the Eastern Caribbean's
    beautiful beaches, the Western Caribbean's adventure destinations, or the Southern Caribbean's exotic islands, we have the perfect cruise
    for you. All bookings include maximum onboard credit to enhance your vacation experience.`,
    filters: {
      regionId: 2, // Caribbean region ID
    },
    priority: 0.9,
    changeFrequency: 'daily',
    keywords: ['caribbean cruises', 'caribbean cruise deals', 'cheap caribbean cruises', 'best caribbean cruises'],
    faqItems: [
      {
        question: 'What is the best time to cruise the Caribbean?',
        answer: 'The best time to cruise the Caribbean is from December to April when the weather is warm and dry. Hurricane season runs from June to November, though cruise lines monitor weather carefully and adjust itineraries as needed.'
      },
      {
        question: 'What Caribbean cruise destinations are most popular?',
        answer: 'Popular Caribbean cruise destinations include Cozumel (Mexico), Jamaica, Grand Cayman, Bahamas, St. Thomas, and Barbados. Each offers unique experiences from beaches to cultural attractions.'
      }
    ]
  },
  {
    slug: 'bahamas',
    name: 'Bahamas',
    title: 'Bahamas Cruises',
    metaTitle: 'Bahamas Cruises 2025-2026 | Short & Week-Long Trips from Florida',
    metaDescription: 'Bahamas cruise deals from Florida ports. Perfect for first-time cruisers and quick getaways. Visit Nassau, Freeport, and private islands with maximum onboard credit.',
    h1: 'Bahamas Cruises - Quick Getaways from Florida',
    description: `Experience the beauty of the Bahamas, just a short cruise from Florida. Perfect for first-time cruisers or quick weekend
    getaways, Bahamas cruises offer pristine beaches, world-class snorkeling, and the excitement of Nassau and Freeport. Many cruises also
    visit private islands like Perfect Day at CocoCay or Castaway Cay. With departures from Miami, Fort Lauderdale, and Port Canaveral,
    your tropical escape is just hours away. Every booking includes maximum onboard credit for the ultimate value.`,
    filters: {
      regionId: 28, // Bahamas region ID
    },
    priority: 0.85,
    changeFrequency: 'daily',
    keywords: ['bahamas cruises', 'nassau cruises', 'bahamas cruise deals', 'short bahamas cruises'],
    faqItems: [
      {
        question: 'How long are typical Bahamas cruises?',
        answer: 'Bahamas cruises range from 3-4 night weekend getaways to 7-night voyages. Short cruises are perfect for first-timers, while week-long cruises offer more island exploration.'
      },
      {
        question: 'Do I need a passport for a Bahamas cruise?',
        answer: 'For closed-loop cruises (departing and returning to the same U.S. port), a birth certificate and government-issued photo ID are acceptable. However, a passport is always recommended.'
      }
    ]
  },
  {
    slug: 'alaska',
    name: 'Alaska',
    title: 'Alaska Cruises',
    metaTitle: 'Alaska Cruises 2025-2026 | Glacier Bay & Inside Passage Tours',
    metaDescription: 'Alaska cruise deals featuring glaciers, wildlife, and stunning scenery. Inside Passage and Glacier Bay itineraries from Seattle and Vancouver with maximum onboard credit.',
    h1: 'Alaska Cruises - Glaciers, Wildlife & Natural Wonders',
    description: `Embark on an unforgettable Alaska cruise through the Inside Passage, where towering glaciers meet the sea and wildlife
    abounds. Experience the majesty of Glacier Bay, the frontier charm of Juneau, Ketchikan, and Skagway, and the stunning natural beauty
    that makes Alaska a bucket-list destination. Watch for whales, eagles, and bears while cruising past snow-capped mountains and pristine
    fjords. Most Alaska cruises run from May through September when weather is mild and wildlife is active.`,
    filters: {
      regionId: 13, // Alaska region ID
    },
    priority: 0.85,
    changeFrequency: 'weekly',
    keywords: ['alaska cruises', 'alaska cruise deals', 'glacier bay cruises', 'inside passage cruises'],
    faqItems: [
      {
        question: 'When is the best time for an Alaska cruise?',
        answer: 'The Alaska cruise season runs from May through September. June through August offer the warmest weather and longest days, while May and September can offer better deals and fewer crowds.'
      },
      {
        question: 'What should I pack for an Alaska cruise?',
        answer: 'Pack layers including waterproof jackets, warm sweaters, comfortable walking shoes, and binoculars for wildlife viewing. Even in summer, temperatures can be cool, especially near glaciers.'
      }
    ]
  },
  {
    slug: 'mediterranean',
    name: 'Mediterranean',
    title: 'Mediterranean Cruises',
    metaTitle: 'Mediterranean Cruises 2025-2026 | Rome, Barcelona & Greek Isles',
    metaDescription: 'Mediterranean cruise deals visiting Italy, Spain, France, and Greek Islands. Experience history, culture, and cuisine with maximum onboard credit on every booking.',
    h1: 'Mediterranean Cruises - History, Culture & Coastal Beauty',
    description: `Discover the treasures of the Mediterranean on cruises that combine ancient history, stunning coastlines, and world-renowned
    cuisine. Visit iconic cities like Rome, Barcelona, and Athens, explore the French Riviera, or island-hop through the Greek Isles.
    Mediterranean cruises offer incredible diversity, from the art galleries of Florence to the beaches of Mykonos, the ruins of Ephesus
    to the glamour of Monte Carlo. With ports rich in history and culture, every day brings new adventures.`,
    filters: {
      regionId: [3, 4, 7, 8], // Mediterranean region IDs (will need to verify these)
    },
    priority: 0.85,
    changeFrequency: 'weekly',
    keywords: ['mediterranean cruises', 'mediterranean cruise deals', 'greek isles cruises', 'italy cruises'],
    faqItems: [
      {
        question: 'What is the best time for a Mediterranean cruise?',
        answer: 'April through October offers the best weather for Mediterranean cruises. July and August are warmest but most crowded, while April-May and September-October offer pleasant weather with fewer tourists.'
      },
      {
        question: 'Which Mediterranean ports are must-see destinations?',
        answer: 'Popular Mediterranean ports include Rome (Civitavecchia), Barcelona, Venice, Santorini, Dubrovnik, and Marseille. Each offers unique experiences from ancient ruins to stunning beaches.'
      }
    ]
  },
  {
    slug: 'europe',
    name: 'Europe',
    title: 'European Cruises',
    metaTitle: 'Europe Cruises 2025-2026 | Northern Europe, Baltic & British Isles',
    metaDescription: 'European cruise deals including Norwegian Fjords, Baltic capitals, and British Isles. Explore historic cities and dramatic landscapes with maximum onboard credit.',
    h1: 'European Cruises - Fjords, Capitals & Historic Ports',
    description: `Explore the diverse wonders of Europe by cruise, from the dramatic Norwegian Fjords to the Baltic capitals, the British Isles
    to the Iberian Peninsula. European cruises offer unparalleled variety - witness the Northern Lights, explore medieval cities, visit
    royal palaces, and cruise past stunning coastal scenery. Popular itineraries include the Norwegian Fjords with their waterfalls and
    mountains, Baltic cruises visiting St. Petersburg, Stockholm, and Copenhagen, and British Isles voyages exploring Scotland and Ireland.`,
    filters: {
      regionId: [6, 9, 10, 16], // European region IDs
    },
    priority: 0.8,
    changeFrequency: 'weekly',
    keywords: ['europe cruises', 'european cruise deals', 'norwegian fjords cruises', 'baltic cruises'],
    faqItems: [
      {
        question: 'When should I cruise to Europe?',
        answer: 'May through September is ideal for most European cruises. Norwegian Fjords and Baltic cruises are best June-August, while the Atlantic coast can be enjoyed April-October.'
      },
      {
        question: 'Do I need visas for a European cruise?',
        answer: 'U.S. citizens typically don\'t need visas for short stays in European Union countries. However, requirements vary by nationality and some ports (like St. Petersburg) may require tour-arranged visas.'
      }
    ]
  }
];

// Cruise line categories
export const cruiseLineCategories: CategoryConfig[] = [
  {
    slug: 'royal-caribbean',
    name: 'Royal Caribbean',
    title: 'Royal Caribbean Cruises',
    metaTitle: 'Royal Caribbean Cruises 2025-2026 | Best Deals & Maximum Onboard Credit',
    metaDescription: 'Royal Caribbean cruise deals on the world\'s most innovative ships. Book Icon, Wonder, Symphony of the Seas and more with maximum onboard credit included.',
    h1: 'Royal Caribbean Cruises - Innovation at Sea',
    description: `Experience the extraordinary with Royal Caribbean, home to the world's largest and most innovative cruise ships. From the
    record-breaking Icon of the Seas to the revolutionary Oasis Class vessels, Royal Caribbean offers unmatched onboard experiences including
    surf simulators, rock climbing walls, ice skating rinks, and Central Park at sea. With itineraries worldwide and activities for all ages,
    Royal Caribbean delivers unforgettable vacations with something for everyone.`,
    filters: {
      cruiseLineId: 22,
    },
    priority: 0.8,
    changeFrequency: 'daily',
    keywords: ['royal caribbean cruises', 'royal caribbean deals', 'icon of the seas', 'symphony of the seas']
  },
  {
    slug: 'carnival',
    name: 'Carnival',
    title: 'Carnival Cruises',
    metaTitle: 'Carnival Cruise Deals 2025-2026 | Fun Ships with Maximum Onboard Credit',
    metaDescription: 'Carnival Cruise Line deals on Fun Ships sailing from ports across America. Family-friendly cruises to Caribbean, Bahamas, and Mexico with maximum onboard credit.',
    h1: 'Carnival Cruises - Choose Fun at Sea',
    description: `Set sail with Carnival Cruise Line, "The World's Most Popular Cruise Line®" offering fun, affordable vacations to the
    Caribbean, Bahamas, Mexico, and beyond. Known for their "Fun Ships," Carnival features exciting amenities like the BOLT roller coaster,
    WaterWorks aqua parks, and diverse dining options from Guy's Burger Joint to the Steakhouse. With departures from 14 U.S. ports and
    a focus on fun for all ages, Carnival makes cruising accessible and entertaining for everyone.`,
    filters: {
      cruiseLineId: 8,
    },
    priority: 0.8,
    changeFrequency: 'daily',
    keywords: ['carnival cruises', 'carnival cruise deals', 'fun ships', 'carnival cruise line']
  },
  {
    slug: 'norwegian',
    name: 'Norwegian',
    title: 'Norwegian Cruise Line',
    metaTitle: 'Norwegian Cruise Line Deals 2025-2026 | NCL Freestyle Cruising',
    metaDescription: 'Norwegian Cruise Line deals with freestyle cruising. No fixed dining times or dress codes. Caribbean, Alaska, and Europe cruises with maximum onboard credit.',
    h1: 'Norwegian Cruise Line - Freestyle Cruising',
    description: `Cruise like no other with Norwegian Cruise Line's Freestyle Cruising - no fixed dining times, no formal dress codes, and
    endless options for entertainment and relaxation. NCL's innovative ships feature The Haven luxury suites, go-kart racing at sea, and
    Broadway shows. With a wide variety of restaurants, bars, and activities, plus destinations worldwide including their private island
    Great Stirrup Cay, Norwegian offers the freedom and flexibility to vacation your way.`,
    filters: {
      cruiseLineId: 17,
    },
    priority: 0.8,
    changeFrequency: 'daily',
    keywords: ['norwegian cruise line', 'ncl cruises', 'freestyle cruising', 'norwegian cruise deals']
  },
  {
    slug: 'msc-cruises',
    name: 'MSC Cruises',
    title: 'MSC Cruises',
    metaTitle: 'MSC Cruises 2025-2026 | Mediterranean Style Cruising Worldwide',
    metaDescription: 'MSC Cruises brings European elegance to seas worldwide. Mediterranean, Caribbean, and Northern Europe cruises with maximum onboard credit on every booking.',
    h1: 'MSC Cruises - Mediterranean Style, Worldwide',
    description: `Experience Mediterranean elegance with MSC Cruises, one of the world's largest privately-owned cruise lines. Combining
    European sophistication with international appeal, MSC offers stunning ships featuring Swarovski crystal staircases, authentic
    Mediterranean cuisine, and the exclusive MSC Yacht Club ship-within-a-ship luxury experience. With a strong presence in the Mediterranean
    and Caribbean, plus innovative features like the MSC for Me technology and Cirque du Soleil at Sea, MSC delivers a unique cruise experience.`,
    filters: {
      cruiseLineId: 16,
    },
    priority: 0.75,
    changeFrequency: 'daily',
    keywords: ['msc cruises', 'msc cruise deals', 'mediterranean cruises', 'msc yacht club']
  },
  {
    slug: 'celebrity',
    name: 'Celebrity',
    title: 'Celebrity Cruises',
    metaTitle: 'Celebrity Cruises 2025-2026 | Modern Luxury at Sea',
    metaDescription: 'Celebrity Cruises offers modern luxury experiences with award-winning cuisine and innovative Edge Class ships. Maximum onboard credit on all bookings.',
    h1: 'Celebrity Cruises - Modern Luxury Lives Here',
    description: `Sail with Celebrity Cruises and experience modern luxury at its finest. Known for innovative Edge Class ships with infinite
    verandas and the revolutionary Magic Carpet platform, Celebrity combines cutting-edge design with exceptional service. Enjoy world-class
    dining curated by Michelin-starred chefs, luxurious spa facilities, and thoughtfully curated art collections. With destinations spanning
    all seven continents and The Retreat for suite guests, Celebrity delivers an elevated cruise experience.`,
    filters: {
      cruiseLineId: 3,
    },
    priority: 0.75,
    changeFrequency: 'daily',
    keywords: ['celebrity cruises', 'celebrity edge', 'modern luxury cruises', 'celebrity cruise deals']
  },
  {
    slug: 'princess',
    name: 'Princess',
    title: 'Princess Cruises',
    metaTitle: 'Princess Cruises 2025-2026 | Come Back New with Maximum Onboard Credit',
    metaDescription: 'Princess Cruises to Alaska, Caribbean, Europe and beyond. Experience MedallionClass service and come back new with maximum onboard credit included.',
    h1: 'Princess Cruises - Come Back New',
    description: `Escape completely with Princess Cruises and their "Come Back New" promise. Featuring the innovative MedallionClass experience
    with the OceanMedallion wearable device for touchless experiences, Princess combines traditional elegance with modern technology. Known
    for their Alaska expertise, worldwide itineraries, and Movies Under the Stars, Princess offers enriching experiences from culinary
    demonstrations to Broadway-style productions. With spacious ships and attentive service, Princess creates memorable voyages.`,
    filters: {
      cruiseLineId: 20,
    },
    priority: 0.75,
    changeFrequency: 'daily',
    keywords: ['princess cruises', 'princess cruise deals', 'medallionclass', 'alaska cruises']
  }
];

// Departure port categories
export const departurePortCategories: CategoryConfig[] = [
  {
    slug: 'from-miami',
    name: 'Miami Departures',
    title: 'Cruises from Miami',
    metaTitle: 'Cruises from Miami 2025-2026 | Caribbean & Bahamas Departures',
    metaDescription: 'Cruise deals departing from Miami to Caribbean, Bahamas, and Mexico. The Cruise Capital of the World offers year-round departures with maximum onboard credit.',
    h1: 'Cruises from Miami - Gateway to the Caribbean',
    description: `Depart from the Cruise Capital of the World - Miami, Florida. With year-round sunshine and the world's busiest cruise port,
    Miami offers unparalleled access to the Caribbean, Bahamas, and Mexico. The port serves all major cruise lines with state-of-the-art
    terminals and easy access from Miami International Airport. Whether you're seeking a quick Bahamas getaway or an extended Caribbean
    adventure, Miami's central location makes it the perfect departure point.`,
    filters: {
      departurePortId: [195, 5924], // Miami port IDs - need to verify
    },
    priority: 0.75,
    changeFrequency: 'daily',
    keywords: ['cruises from miami', 'miami cruise port', 'miami cruise deals', 'caribbean cruises from miami']
  },
  {
    slug: 'from-fort-lauderdale',
    name: 'Fort Lauderdale Departures',
    title: 'Cruises from Fort Lauderdale',
    metaTitle: 'Cruises from Fort Lauderdale (Port Everglades) 2025-2026',
    metaDescription: 'Cruise deals from Fort Lauderdale\'s Port Everglades to Caribbean and beyond. Convenient South Florida departures with maximum onboard credit.',
    h1: 'Cruises from Fort Lauderdale - Port Everglades',
    description: `Sail from Port Everglades in Fort Lauderdale, one of the world's top cruise ports. Located just minutes from Fort Lauderdale
    Airport and beautiful beaches, Port Everglades offers modern facilities and serves as home port for major cruise lines. The port's
    convenient location provides easy access to Eastern and Western Caribbean itineraries, plus transatlantic and South America cruises.
    With excellent pre-cruise hotels and attractions nearby, Fort Lauderdale makes starting your cruise vacation seamless.`,
    filters: {
      departurePortId: [95], // Fort Lauderdale port IDs - need to verify
    },
    priority: 0.75,
    changeFrequency: 'daily',
    keywords: ['cruises from fort lauderdale', 'port everglades cruises', 'fort lauderdale cruise deals']
  },
  {
    slug: 'from-galveston',
    name: 'Galveston Departures',
    title: 'Cruises from Galveston',
    metaTitle: 'Cruises from Galveston, Texas 2025-2026 | Western Caribbean Cruises',
    metaDescription: 'Cruise deals from Galveston, Texas to Western Caribbean and Mexico. Convenient departures from the Gulf Coast with maximum onboard credit.',
    h1: 'Cruises from Galveston - Texas Gulf Coast Departures',
    description: `Embark from Galveston, Texas, the Western Caribbean's gateway port. Located just an hour from Houston, Galveston offers a
    convenient departure point for Texas and central U.S. travelers. The port features year-round cruises to the Western Caribbean, including
    Cozumel, Jamaica, and Grand Cayman. With historic charm, nearby attractions, and less crowded terminals than Florida ports, Galveston
    provides a relaxed start to your cruise vacation.`,
    filters: {
      departurePortId: [102], // Galveston port IDs - need to verify
    },
    priority: 0.7,
    changeFrequency: 'daily',
    keywords: ['cruises from galveston', 'galveston cruise port', 'texas cruises', 'galveston cruise deals']
  },
  {
    slug: 'from-new-york',
    name: 'New York Departures',
    title: 'Cruises from New York',
    metaTitle: 'Cruises from New York (Manhattan) 2025-2026 | Bermuda & Caribbean',
    metaDescription: 'Cruise deals from New York City to Bermuda, Caribbean, Canada, and transatlantic. Sail from Manhattan with views of the Statue of Liberty.',
    h1: 'Cruises from New York - Sail from the Big Apple',
    description: `Depart from the iconic Manhattan Cruise Terminal in New York City, sailing past the Statue of Liberty and under the Verrazzano
    Bridge. New York offers diverse itineraries including Bermuda, Caribbean, Canada/New England, and transatlantic crossings. The Manhattan
    and Brooklyn cruise terminals provide easy access via public transportation or car, making it convenient for Northeast travelers. Experience
    the excitement of sailing from one of the world's greatest cities.`,
    filters: {
      departurePortId: [207], // New York port IDs
    },
    priority: 0.7,
    changeFrequency: 'weekly',
    keywords: ['cruises from new york', 'nyc cruises', 'manhattan cruise terminal', 'new york cruise deals']
  },
  {
    slug: 'from-seattle',
    name: 'Seattle Departures',
    title: 'Cruises from Seattle',
    metaTitle: 'Cruises from Seattle 2025-2026 | Alaska Inside Passage Cruises',
    metaDescription: 'Alaska cruise deals from Seattle. Convenient West Coast departures to Inside Passage and Glacier Bay with maximum onboard credit.',
    h1: 'Cruises from Seattle - Your Alaska Adventure Starts Here',
    description: `Begin your Alaska adventure from Seattle's modern cruise terminals. As a major Alaska cruise homeport, Seattle offers
    convenient access to the Inside Passage without international travel. The port is located minutes from Seattle-Tacoma International
    Airport and downtown attractions like Pike Place Market. Most Alaska cruises from Seattle are 7-day round trips visiting Juneau,
    Ketchikan, Skagway, and Victoria, BC. The scenic sail through the Inside Passage begins right from departure.`,
    filters: {
      departurePortId: [280], // Seattle port IDs - need to verify
    },
    priority: 0.7,
    changeFrequency: 'weekly',
    keywords: ['cruises from seattle', 'seattle alaska cruises', 'seattle cruise port', 'alaska cruises from seattle']
  }
];

// Special categories
export const specialCategories: CategoryConfig[] = [
  {
    slug: '7-night',
    name: '7 Night Cruises',
    title: '7 Night Cruises',
    metaTitle: '7 Night Cruises 2025-2026 | Week-Long Cruise Vacations',
    metaDescription: 'Popular 7-night cruise deals perfect for a week-long vacation. Caribbean, Alaska, Mediterranean itineraries with maximum onboard credit.',
    h1: '7 Night Cruises - The Perfect Week at Sea',
    description: `Seven-night cruises offer the perfect balance of relaxation and exploration. Long enough to truly unwind and visit multiple
    destinations, yet fitting neatly into a week's vacation time. These week-long voyages are the most popular cruise length, offering
    excellent value and variety. Visit 3-5 ports while enjoying sea days to experience all your ship has to offer. From Caribbean island
    hopping to Alaska glacier watching, 7-night cruises provide the ideal cruise experience.`,
    filters: {
      minNights: 7,
      maxNights: 7,
    },
    priority: 0.75,
    changeFrequency: 'daily',
    keywords: ['7 night cruises', '7 day cruises', 'week long cruises', 'seven night cruises']
  },
  {
    slug: '3-5-nights',
    name: 'Short Cruises',
    title: '3-5 Night Cruises',
    metaTitle: '3-5 Night Short Cruises 2025-2026 | Weekend Getaways',
    metaDescription: 'Short 3-5 night cruise deals perfect for long weekends and quick getaways. Bahamas and Mexico cruises with maximum onboard credit.',
    h1: '3-5 Night Cruises - Quick Escapes & Weekend Getaways',
    description: `Perfect for first-time cruisers or when you need a quick escape, 3-5 night cruises offer a taste of the cruise experience
    without a major time commitment. These short cruises typically visit the Bahamas, Mexico's Caribbean coast, or include relaxing sea days.
    Ideal for long weekends, these voyages let you experience cruise ship amenities, entertainment, and dining while visiting nearby tropical
    destinations. They're also budget-friendly options for trying out different cruise lines.`,
    filters: {
      minNights: 3,
      maxNights: 5,
    },
    priority: 0.7,
    changeFrequency: 'daily',
    keywords: ['short cruises', '3 night cruises', '4 night cruises', '5 night cruises', 'weekend cruises']
  },
  {
    slug: 'cheap',
    name: 'Cheap Cruises',
    title: 'Cheap Cruises Under $500',
    metaTitle: 'Cheap Cruises Under $500 Per Person 2025-2026 | Budget Cruise Deals',
    metaDescription: 'Affordable cruise deals under $500 per person. Budget-friendly Caribbean and Bahamas cruises with maximum onboard credit included.',
    h1: 'Cheap Cruises - Amazing Deals Under $500',
    description: `Discover incredible cruise values with our selection of cruises under $500 per person. These budget-friendly options prove
    that you don't need to spend a fortune for an amazing cruise vacation. Including shorter Bahamas getaways, off-season Caribbean voyages,
    and last-minute deals, these affordable cruises still include meals, entertainment, and accommodations. Plus, with maximum onboard credit
    included, you'll have extra spending money for drinks, excursions, and spa treatments.`,
    filters: {
      maxPrice: 500,
    },
    priority: 0.8,
    changeFrequency: 'hourly',
    keywords: ['cheap cruises', 'cruise deals under 500', 'budget cruises', 'affordable cruises', 'discount cruises']
  },
  {
    slug: 'last-minute',
    name: 'Last Minute Cruises',
    title: 'Last Minute Cruises',
    metaTitle: 'Last Minute Cruise Deals 2025 | Departing Within 60 Days',
    metaDescription: 'Last minute cruise deals departing soon. Save on cruises leaving within 60 days with maximum onboard credit included on all bookings.',
    h1: 'Last Minute Cruises - Sail Soon & Save Big',
    description: `Take advantage of last-minute cruise deals departing within the next 60 days. Cruise lines offer significant discounts to
    fill remaining cabins, making these some of the best values in cruising. Perfect for flexible travelers who can pack and go, last-minute
    cruises offer the same great experience at reduced prices. Whether you're looking for a spontaneous getaway or monitoring prices for the
    best deal, these soon-to-sail voyages deliver exceptional value with maximum onboard credit included.`,
    filters: {
      // Will need to implement date filter in the page component
    },
    priority: 0.85,
    changeFrequency: 'hourly',
    keywords: ['last minute cruises', 'last minute cruise deals', 'cruises departing soon', 'late cruise deals']
  }
];

// Combine all categories for easy lookup
export const allCategories: CategoryConfig[] = [
  ...destinationCategories,
  ...cruiseLineCategories,
  ...departurePortCategories,
  ...specialCategories
];

// Helper function to get category by slug
export function getCategoryBySlug(slug: string): CategoryConfig | undefined {
  return allCategories.find(cat => cat.slug === slug);
}

// Helper function to generate sitemap entries
export function getCategorySitemapEntries() {
  return allCategories.map(category => ({
    url: `/cruises/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: category.changeFrequency || 'weekly',
    priority: category.priority || 0.7,
  }));
}
