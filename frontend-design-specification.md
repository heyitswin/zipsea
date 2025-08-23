# Zipsea Frontend Design Specification

## Project Overview

Zipsea is a modern cruise-focused Online Travel Agency (OTA) platform designed to revolutionize cruise booking by offering superior onboard credit (OBC) values. This specification outlines the complete frontend implementation for the homepage and core user interface components.

**Key Value Proposition**: "The most onboard credit, simple as that" - maximum OBC allowed by cruise lines on every booking.

## Technology Stack

### Recommended Frontend Framework
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS Modules for custom components
- **UI Components**: Radix UI primitives + custom Zipsea components
- **Date Picker**: react-day-picker or @mui/x-date-pickers
- **Icons**: Lucide React + custom SVGs
- **Animation**: Framer Motion
- **State Management**: Zustand (for complex state) + React Server Components
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Native fetch with Next.js

### Development Tools
- **Build Tool**: Next.js built-in (webpack/turbopack)
- **Package Manager**: npm (to match backend)
- **Linting**: ESLint + Prettier
- **Testing**: Jest + React Testing Library
- **Performance**: Next.js Image optimization, bundle analyzer

## Design System Foundation

### Color Palette

```css
:root {
  /* Primary Colors */
  --zipsea-blue: #4C40EE;
  --zipsea-aqua: #88E7EB; 
  --zipsea-sunshine: #F7F170;
  --zipsea-night: #0E1B4D;
  
  /* Secondary Colors */
  --zipsea-candy: #E9B4EB;
  --zipsea-black: #2F2F2F;
  --zipsea-gray: #474747;
  --zipsea-light-gray: #D9D9D9;
  --zipsea-sand: #F6F3ED;
  
  /* Semantic Colors */
  --text-primary: #FFFFFF;
  --text-secondary: rgba(255, 255, 255, 0.8);
  --text-body: #2F2F2F;
  --text-muted: #474747;
  
  /* Interactive States */
  --button-primary: #4C40EE;
  --button-primary-hover: #3F35CC;
  --button-secondary: #88E7EB;
  --button-secondary-hover: #7ADADE;
  
  /* Backgrounds */
  --bg-primary: #4C40EE; /* Hero gradient start */
  --bg-secondary: #88E7EB; /* Hero gradient end */
  --bg-section: #0E1B4D; /* Dark sections */
  --bg-card: #FFFFFF;
  --bg-surface: #F6F3ED;
}
```

### Typography Scale

```css
/* Font Families */
@font-face {
  font-family: 'Whitney';
  src: url('./fonts/whitney_black-webfont.ttf') format('truetype');
  font-weight: 900;
  font-display: swap;
}

@font-face {
  font-family: 'Geograph';
  src: url('./fonts/geograph-regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'Geograph';
  src: url('./fonts/geograph-medium.woff2') format('woff2');
  font-weight: 500;
  font-display: swap;
}

@font-face {
  font-family: 'Geograph';
  src: url('./fonts/geograph-bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

@font-face {
  font-family: 'Geograph';
  src: url('./fonts/geograph-black.woff2') format('woff2');
  font-weight: 900;
  font-display: swap;
}

/* Typography System */
.text-hero {
  font-family: 'Whitney', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.text-h1 {
  font-family: 'Whitney', sans-serif;
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 900;
  line-height: 1.2;
}

.text-h2 {
  font-family: 'Geograph', sans-serif;
  font-size: clamp(1.5rem, 2.5vw, 2rem);
  font-weight: 700;
  line-height: 1.3;
}

.text-body-large {
  font-family: 'Geograph', sans-serif;
  font-size: 1.125rem;
  font-weight: 400;
  line-height: 1.6;
}

.text-body {
  font-family: 'Geograph', sans-serif;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.6;
}
```

### Spacing System

```css
:root {
  --space-xs: 0.25rem;    /* 4px */
  --space-sm: 0.5rem;     /* 8px */
  --space-md: 1rem;       /* 16px */
  --space-lg: 1.5rem;     /* 24px */
  --space-xl: 2rem;       /* 32px */
  --space-2xl: 3rem;      /* 48px */
  --space-3xl: 4rem;      /* 64px */
  --space-4xl: 6rem;      /* 96px */
  --space-5xl: 8rem;      /* 128px */
  
  /* Container Widths */
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1280px;
  --container-2xl: 1536px;
}
```

### Breakpoints

```css
/* Mobile First Breakpoints */
/* xs: 0px */
/* sm: 640px */
/* md: 768px */
/* lg: 1024px */
/* xl: 1280px */
/* 2xl: 1536px */
```

## Component Architecture

### Navigation Header

**Purpose**: Top navigation with logo, menu items, and CTA
**Location**: Sticky header across all pages

```typescript
interface HeaderProps {
  transparent?: boolean;
  showSearch?: boolean;
}

interface NavigationItem {
  label: string;
  href: string;
  external?: boolean;
}
```

**Visual Specifications**:
- Height: 80px desktop, 64px mobile
- Background: White with subtle shadow when scrolled
- Logo: SVG format, 110x31px at 1x scale
- Navigation items: Geograph Medium, 16px, #474747
- CTA button: Primary blue background

**Implementation Example**:
```tsx
import { ZipseaLogo } from './icons/ZipseaLogo';

export function Header({ transparent = false, showSearch = false }: HeaderProps) {
  return (
    <header className={cn(
      "sticky top-0 z-50 transition-all duration-300",
      transparent ? "bg-transparent" : "bg-white shadow-sm"
    )}>
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-20 lg:h-20">
          <ZipseaLogo className="h-8 w-auto" />
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-gray-700 hover:text-blue-600">How we make money</a>
            <a href="#" className="text-gray-700 hover:text-blue-600">About us</a>
            <a href="#" className="text-gray-700 hover:text-blue-600">FAQ</a>
          </nav>
        </div>
      </div>
    </header>
  );
}
```

### Hero Section

**Purpose**: Main value proposition with cruise search functionality
**Key Features**: Gradient background, floating icons, search form

```typescript
interface HeroSearchProps {
  onSearch: (ship: string, date: Date) => void;
  ships: Ship[];
  loading?: boolean;
}

interface Ship {
  id: string;
  name: string;
  cruiseLine: string;
}
```

**Visual Specifications**:
- Background: Linear gradient from #4C40EE to #88E7EB
- Decorative elements: Floating circular icons with ship/anchor illustrations
- Typography: Whitney Black for main headline, Geograph for subtitle
- Search form: White rounded container with ship selector and date picker
- Height: 100vh on desktop, min-height 600px

**Wave Transition**: CSS clip-path for ocean wave effect between sections

```css
.hero-wave {
  clip-path: polygon(0 0, 100% 0, 100% 85%, 0 100%);
}
```

### Search Form Component

**Purpose**: Primary search interface for ship and date selection
**Variants**: Homepage hero, compact header version

```typescript
interface SearchFormProps {
  variant?: 'hero' | 'compact';
  ships: Ship[];
  onSubmit: (data: SearchFormData) => void;
  loading?: boolean;
}

interface SearchFormData {
  shipId: string;
  departureDate: Date;
}
```

**Visual Specifications**:
- Container: White background, rounded-full (9999px)
- Layout: Flexbox with ship selector (60%) + date picker (30%) + search button (10%)
- Ship selector: Dropdown with search/filter capability
- Date picker: Calendar overlay, highlights available dates
- Search button: Navy blue (#0E1B4D) circular button with search icon

**States**:
- Default: Clean white form
- Ship focused: Dropdown opens with ship list
- Date focused: Calendar picker opens
- Loading: Search button shows spinner
- Error: Red border with error message below

### Date Picker Component

**Purpose**: Calendar interface for departure date selection
**Features**: Month navigation, date availability, responsive design

```typescript
interface DatePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  availableDates?: Date[];
}
```

**Visual Specifications**:
- Calendar grid: 7-column layout for days of week
- Available dates: Default styling
- Selected date: Blue background (#4C40EE)
- Disabled dates: Gray text, not clickable
- Navigation arrows: Left/right for month switching
- Month/year header: Geograph Bold, centered

**Recommended Package**: react-day-picker with custom styling

### Ship Selector Dropdown

**Purpose**: Searchable dropdown for cruise ship selection
**Features**: Search/filter, cruise line grouping, keyboard navigation

```typescript
interface ShipSelectorProps {
  ships: Ship[];
  value?: string;
  onChange: (shipId: string) => void;
  placeholder?: string;
  searchable?: boolean;
}
```

**Visual Specifications**:
- Trigger: Input-style with ship icon, placeholder text
- Dropdown: Max height 300px, scrollable
- Options: Ship name + cruise line subtitle
- Search: Filter input at top of dropdown
- Grouping: Optional grouping by cruise line
- Selection: Blue highlight for selected option

### Last Minute Deals Section

**Purpose**: Display cruise deals departing within 4-6 weeks
**Layout**: Responsive grid of cruise cards

```typescript
interface LastMinuteDealsProps {
  cruises: CruiseCard[];
  loading?: boolean;
}

interface CruiseCard {
  id: string;
  name: string;
  cruiseLine: string;
  image: string;
  duration: number;
  departureDate: Date;
  startingPrice: number;
  onboardCredit: number;
  destination: string;
}
```

**Visual Specifications**:
- Section background: Sand color (#F6F3ED)
- Grid: 3 columns desktop, 1 column mobile
- Cards: White background, rounded corners (12px)
- Images: Aspect ratio 16:9, lazy loaded
- Pricing: Prominent OBC display in green badge
- CTA: "Get your deal" button per card

### Cruise Card Component

**Purpose**: Individual cruise listing card
**Variants**: Grid card, list card, featured card

```typescript
interface CruiseCardProps {
  cruise: CruiseCard;
  variant?: 'grid' | 'list' | 'featured';
  onSelect: (cruiseId: string) => void;
  showOBC?: boolean;
}
```

**Visual Specifications**:
- Image: Top-positioned, overlay gradient for text
- Content: Padding 16px, structured information hierarchy
- Typography: Ship name (Geograph Bold), details (Geograph Regular)
- Badge: Green OBC badge, positioned top-right on image
- Button: Primary blue, full width
- Hover state: Subtle scale transform (1.02) and shadow

### OBC Information Section

**Purpose**: Educational content about onboard credit benefits
**Layout**: Dark navy background with white text and colorful icons

**Visual Specifications**:
- Background: Navy (#0E1B4D)
- Typography: White text, various sizes
- Icon grid: 6 colorful circular icons representing OBC uses
- Layout: Centered content with max-width container
- Icons: Custom illustrations for Wi-Fi, Dining, Drinks, Shopping, Activities, Spa

### Footer Component

**Purpose**: Site-wide footer with legal links and branding
**Content**: Minimal links, logo, copyright

```typescript
interface FooterProps {
  links: FooterLink[];
}

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}
```

## Responsive Design System

### Mobile-First Implementation

**Breakpoint Strategy**:
- Design for mobile (320px-640px) first
- Progressive enhancement for tablet (640px-1024px)
- Desktop optimization (1024px+)

**Key Responsive Patterns**:
1. **Hero Search**: Stack vertically on mobile, horizontal on desktop
2. **Navigation**: Hamburger menu on mobile, horizontal nav on desktop
3. **Cruise Cards**: Single column mobile, grid on larger screens
4. **Typography**: Fluid scaling with clamp() CSS function

### Touch Optimization

- Minimum touch target: 44px x 44px
- Increased spacing on mobile interfaces
- Swipe gestures for image galleries
- Touch-friendly form controls

## Performance Considerations

### Image Optimization
- Next.js Image component with lazy loading
- WebP format with fallbacks
- Responsive image sizing
- Placeholder blur for smooth loading

### Bundle Optimization
- Code splitting by route and component
- Tree shaking for unused code
- Font subsetting for custom fonts
- Critical CSS inlining for above-fold content

### Core Web Vitals Targets
- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

## State Management Architecture

### Global State (Zustand)
```typescript
interface AppState {
  // Search state
  searchForm: SearchFormData;
  searchResults: CruiseCard[];
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // User preferences
  savedSearches: SavedSearch[];
  preferences: UserPreferences;
}
```

### Server State (React Query)
- Cruise data fetching
- Search result caching
- Background updates
- Optimistic updates for user actions

## API Integration

### Backend Endpoints
Based on the existing backend structure:

```typescript
// Search API
GET /api/search?ship={shipId}&date={date}

// Cruise details
GET /api/cruises/{cruiseId}

// Ships list
GET /api/ships

// Quote request
POST /api/quotes
```

### Error Handling
- Network error boundaries
- Graceful degradation for API failures
- User-friendly error messages
- Retry mechanisms for transient failures

## Accessibility Requirements

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Screen Readers**: Proper ARIA labels and roles
- **Color Contrast**: Minimum 4.5:1 ratio for normal text
- **Focus Indicators**: Visible focus states for all interactive elements

### Implementation Checklist
- [ ] Alt text for all images
- [ ] ARIA labels for form controls
- [ ] Semantic HTML structure
- [ ] Keyboard-only navigation testing
- [ ] Screen reader testing
- [ ] Color contrast validation

## Development Workflow

### Project Structure
```
/frontend
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── page.tsx        # Homepage
│   │   ├── layout.tsx      # Root layout
│   │   └── globals.css     # Global styles
│   ├── components/         # React components
│   │   ├── ui/            # Base UI components
│   │   ├── forms/         # Form components
│   │   ├── layout/        # Layout components
│   │   └── cruise/        # Cruise-specific components
│   ├── lib/               # Utility functions
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript definitions
│   └── styles/            # CSS modules and utilities
├── public/
│   ├── fonts/             # Custom fonts
│   ├── images/            # Static images
│   └── icons/             # SVG icons
└── package.json
```

### Setup Commands
```bash
# Initialize Next.js project
npx create-next-app@latest frontend --typescript --tailwind --app

# Install dependencies
npm install @radix-ui/react-dropdown-menu @radix-ui/react-calendar
npm install react-hook-form @hookform/resolvers zod
npm install framer-motion lucide-react
npm install zustand react-query
npm install @next/bundle-analyzer

# Development
npm run dev

# Build
npm run build

# Start production
npm start
```

### Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=https://zipsea.com
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

## Testing Strategy

### Unit Testing
- Component testing with React Testing Library
- Hook testing with @testing-library/react-hooks
- Utility function testing with Jest

### Integration Testing
- User flow testing (search, selection, quote request)
- API integration testing
- Form validation testing

### Performance Testing
- Lighthouse CI integration
- Bundle size monitoring
- Load testing for search functionality

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
1. [ ] Next.js project setup with TypeScript
2. [ ] Design system implementation (colors, fonts, spacing)
3. [ ] Base UI components (Button, Input, Card)
4. [ ] Layout components (Header, Footer)

### Phase 2: Core Features (Week 3-4)
1. [ ] Homepage hero section with search form
2. [ ] Ship selector dropdown with search
3. [ ] Date picker integration
4. [ ] Search functionality and API integration
5. [ ] Last minute deals section

### Phase 3: Enhancement (Week 5-6)
1. [ ] Mobile responsiveness optimization
2. [ ] Performance optimization
3. [ ] Accessibility improvements
4. [ ] Error handling and loading states
5. [ ] SEO optimization

### Phase 4: Polish (Week 7-8)
1. [ ] Animation and micro-interactions
2. [ ] Cross-browser testing
3. [ ] Performance monitoring setup
4. [ ] User testing and feedback integration
5. [ ] Production deployment preparation

## Success Metrics

### Technical Metrics
- [ ] Page load time < 2 seconds
- [ ] Search response time < 500ms
- [ ] Lighthouse performance score > 90
- [ ] Core Web Vitals in "Good" range
- [ ] Zero accessibility violations

### User Experience Metrics
- [ ] Search completion rate > 85%
- [ ] Mobile usability score > 95
- [ ] Error rate < 0.1%
- [ ] User session duration > 3 minutes

This comprehensive specification provides the foundation for building a pixel-perfect, performant, and accessible Zipsea homepage that aligns with the brand vision and technical requirements.