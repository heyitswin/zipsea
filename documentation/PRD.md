# Zipsea Cruise OTA Platform - Product Requirements Document

**Version:** 1.0  
**Date:** August 2025  
**Document Owner:** Product Management Team

## Product overview

Zipsea is a modern cruise-focused Online Travel Agency (OTA) platform designed to revolutionize how customers search, discover, and book cruise vacations. The platform differentiates itself by offering significantly more onboard credit (OBC) back to customers compared to existing cruise OTAs, while providing a superior user experience through modern design and intuitive functionality.

This document outlines the complete product requirements for building Zipsea from the ground up, including technical architecture, user experience, and development strategy.

## Goals

### Business goals

- Establish Zipsea as a leading cruise-focused OTA by capturing market share through superior onboard credit offerings
- Generate revenue through commission-based bookings while maximizing customer value through enhanced OBC returns
- Build a scalable platform capable of handling high-volume cruise searches and booking requests
- Create a sustainable competitive advantage through superior user experience and customer value proposition
- Achieve operational efficiency through automated data management and streamlined quote/booking processes

### User goals

- Easily search and discover cruise options that match their preferences and budget
- Access comprehensive cruise information including itineraries, amenities, and pricing
- Receive more onboard credit value compared to competitors
- Experience a modern, intuitive booking process that saves time and reduces friction
- Get personalized recommendations and relevant cruise deals
- Manage their cruise preferences and communication settings
- Track quote requests and booking status

### Non-goals

- Direct real-time booking capabilities (initial phase handles quotes off-platform)
- Multi-vertical travel booking (hotels, flights, car rentals)
- Social features or community building
- Mobile app development (web-first approach)
- Inventory management or direct supplier relationships

## User personas

### Primary persona: Experienced cruise traveler
- **Demographics:** Ages 35-65, household income $60K+, has taken 3+ cruises
- **Behavior:** Researches extensively, compares prices across platforms, values onboard credit
- **Pain points:** Time-consuming comparison shopping, limited OBC offerings from current OTAs
- **Goals:** Find best value cruise deals with maximum onboard credit benefits

### Secondary persona: First-time cruise booker
- **Demographics:** Ages 25-55, middle to upper-middle income, planning first or second cruise
- **Behavior:** Needs guidance and detailed information, relies on reviews and recommendations
- **Pain points:** Overwhelming options, unclear pricing, fear of making wrong choice
- **Goals:** Understand cruise options, get expert guidance, book with confidence

### Tertiary persona: Group/family planner
- **Demographics:** Ages 30-60, organizing multi-cabin bookings for family or group events
- **Behavior:** Needs special accommodations, group pricing, coordination support
- **Pain points:** Complex booking requirements, coordination challenges, group pricing complexity
- **Goals:** Simplify group booking process, secure group benefits and pricing

### Role-based access
- **Guest users:** Browse cruises, search, view details, submit quote requests
- **Registered users:** Save preferences, track quote requests, manage communication settings
- **Administrative users:** Content management, quote processing, customer support access

## Functional requirements

### High priority requirements

1. **Cruise search and filtering system**
   - Multi-criteria search (destination, dates, cruise line, ship, price range)
   - Advanced filtering options (cabin type, amenities, port departures)
   - Search result sorting and pagination
   - Real-time inventory status from Traveltek data

2. **Cruise detail pages**
   - Comprehensive cruise information display
   - Itinerary details with port information
   - Ship amenities and deck plans
   - Cabin types and pricing tiers
   - Photo galleries and virtual tours

3. **Quote request system**
   - Multi-step quote request form with pricing qualifications
   - Lead capture and customer information collection
   - Quote request tracking and status updates
   - Automated confirmation and follow-up communications

4. **User account management**
   - Clerk-based authentication and registration
   - Profile management and communication preferences
   - Quote request history and tracking
   - Saved searches and wishlist functionality

### Medium priority requirements

1. **Data synchronization system**
   - Automated Traveltek FTP connection and data retrieval
   - JSON file processing and database updates
   - Historical data retention and versioning
   - Webhook integration for real-time updates

2. **Performance optimization**
   - Redis caching for frequently accessed data
   - Search result caching and optimization
   - Image optimization and CDN integration
   - Database query optimization

3. **Analytics and monitoring**
   - PostHog integration for user behavior tracking
   - Sentry error tracking and performance monitoring
   - Custom dashboard for business metrics
   - A/B testing capabilities for key user flows

### Low priority requirements

1. **Advanced personalization**
   - Machine learning-based cruise recommendations
   - Dynamic pricing display based on user behavior
   - Personalized email marketing campaigns
   - Advanced user segmentation

2. **Enhanced communication features**
   - Live chat support integration
   - SMS notifications for quote updates
   - Video consultations with cruise specialists
   - Community reviews and ratings system

## User experience

### Entry points
- Organic search traffic through SEO-optimized cruise content
- Direct navigation to zipsea.com
- Paid advertising campaigns and affiliate partnerships
- Email marketing campaigns to registered users
- Social media and content marketing initiatives

### Core experience

**Homepage experience:**
- Hero section with prominent search functionality
- Featured cruise deals and popular destinations
- Value proposition highlighting superior OBC offerings
- Trust signals and customer testimonials

**Search and discovery flow:**
1. User enters search criteria on homepage or dedicated search page
2. System displays filtered results with sorting options
3. User browses cruise cards with key information and pricing
4. User clicks through to detailed cruise information pages
5. User initiates quote request from cruise detail page

**Quote request process:**
1. User clicks "Request Quote" on cruise detail page
2. Multi-step form captures travel preferences and contact information
3. System processes request and generates confirmation
4. User receives email confirmation with quote request details
5. Off-platform follow-up for pricing and booking completion

### Advanced features
- Saved search alerts for price drops and new availability
- Comparison tool for side-by-side cruise evaluation
- Interactive deck plans and cabin selection
- Virtual reality ship tours and destination previews
- Group booking coordination tools

### UI/UX highlights
- Mobile-first responsive design with intuitive navigation
- High-performance search with instant filtering and sorting
- Rich media integration with high-quality cruise imagery
- Progressive disclosure of information to avoid overwhelming users
- Clear pricing display with OBC benefits prominently featured

## Narrative

As a cruise enthusiast, I visit Zipsea when I'm ready to plan my next vacation. I'm immediately drawn to the clean, modern interface that makes searching for cruises effortless. I enter my preferred destination and travel dates, and within seconds I'm viewing a curated selection of cruise options with clear pricing and the onboard credit I'll receive – which I notice is significantly higher than what I've seen elsewhere. I can easily filter by my preferences, read detailed information about each ship and itinerary, and when I find the perfect cruise, I simply request a quote. The process is streamlined and transparent, and I receive prompt, personalized follow-up that helps me complete my booking with confidence, knowing I'm getting the best value for my cruise vacation.

## Success metrics

### User-centric metrics
- Quote request conversion rate (target: 8-12% of unique visitors)
- User registration rate (target: 15-20% of visitors)
- Search-to-detail page conversion rate (target: 25-35%)
- Quote request completion rate (target: 85%+)
- User session duration (target: 5+ minutes average)
- Return visitor rate (target: 30%+ within 6 months)

### Business metrics
- Monthly active users (target: 10,000+ within 12 months)
- Quote-to-booking conversion rate (target: 20-25%)
- Average booking value (target: $3,000+ per booking)
- Customer acquisition cost vs. lifetime value ratio
- Market share growth in cruise OTA segment
- Revenue per visitor and per registered user

### Technical metrics
- **Render staging performance:** Page load time <2 seconds for 95% of pages
- **Search response time:** <500ms on both staging and production environments
- **Render uptime:** 99.9% availability leveraging Render's infrastructure
- **Data sync accuracy:** <1 hour delay for Traveltek webhook updates
- **Error rate:** <0.1% of requests tracked via Sentry on both environments
- **Cache hit rate:** >80% using Render managed Redis
- **Deployment success rate:** >99% for staging and production deployments
- **Environment parity:** Configuration consistency between staging and production

## Technical considerations

### Technical architecture
- **Render cloud platform:** Primary hosting environment for both staging and production
- **Render managed PostgreSQL:** Database hosting with automated backups and scaling
- **Render managed Redis:** Caching layer with high availability
- **Environment groups:** Centralized configuration management across environments
- **GitHub integration:** Automated deployment pipeline from code commits
- **Traveltek API integration:** Primary data source for cruise inventory, pricing, and availability
- **Clerk authentication:** User registration, login, and profile management
- **PostHog analytics:** User behavior tracking and conversion analysis
- **Sentry monitoring:** Error tracking, performance monitoring, and alerting
- **Resend email service:** Transactional emails and marketing communications

### Infrastructure requirements
- **Render web service:** Auto-scaling web application hosting
- **Render background workers:** Automated data processing and job queuing
- **Environment separation:** Distinct staging and production environments
- **Webhook endpoint:** Must be deployed BEFORE Traveltek registration
- **SSL/TLS certificates:** Automatically managed by Render
- **CDN integration:** Global content delivery through Render's network

### Data storage and privacy
- **Primary database:** PostgreSQL for structured cruise data, user profiles, and quote requests
- **Cache layer:** Redis for search results, frequently accessed cruise data, and session management
- **Data retention:** Historical cruise data for trending analysis and price comparison
- **Privacy compliance:** GDPR and CCPA compliant data handling and user consent management
- **Data security:** Encrypted data transmission, secure API endpoints, and regular security audits

### Scalability and performance
- **Horizontal scaling:** Cloud-based architecture supporting auto-scaling based on demand
- **Database optimization:** Indexed search queries, connection pooling, and read replicas
- **CDN integration:** Global content delivery for images and static assets
- **Caching strategy:** Multi-layer caching including browser, CDN, application, and database levels
- **Load balancing:** Distributed request handling for high-traffic periods

### Potential challenges
- **Data synchronization complexity:** Managing large-scale FTP data transfers using Render background workers
- **Search performance:** Optimizing complex multi-criteria searches using Render managed Redis
- **Third-party reliability:** Dependency on Traveltek API availability and webhook reliability
- **Environment configuration:** Maintaining consistency between staging and production environments
- **Render service limits:** Understanding and planning for Render's service constraints and scaling
- **Webhook timing:** Ensuring webhook endpoint is deployed before Traveltek integration
- **Seasonal traffic spikes:** Leveraging Render's auto-scaling for peak booking periods

### Deployment strategy
- **Staging-first approach:** All development testing occurs on Render staging environment
- **GitHub integration:** Automated deployments triggered by code commits to main branch
- **Environment groups:** Centralized management of environment variables and secrets
- **Database migrations:** Automated schema updates during deployment process
- **Zero-downtime deployments:** Render's rolling deployment strategy for production updates
- **Rollback capabilities:** Quick reversion to previous deployment in case of issues
- **Branch previews:** Temporary environments for feature branch testing

### Testing strategy
- **Render staging testing:** All functional and integration testing performed on live staging environment
- **No local development:** Developers push to GitHub, test on deployed staging services
- **Database testing:** Use staging PostgreSQL instance with production-like data structure
- **Cache testing:** Validate Redis functionality using Render managed service
- **Webhook testing:** Verify Traveltek integration on deployed staging endpoint
- **Performance testing:** Load testing against Render staging infrastructure
- **User acceptance testing:** Stakeholder validation using staging environment URLs
- **Production validation:** Smoke tests on production after deployment

### Environment management
- **Staging environment group:** Contains all non-sensitive configuration for development testing
- **Production environment group:** Secure configuration with production API keys and secrets
- **Database separation:** Distinct PostgreSQL instances for staging and production
- **Redis separation:** Independent cache instances to prevent data mixing
- **Secret management:** All sensitive data managed through Render dashboard
- **Configuration drift prevention:** Environment groups ensure consistency across deployments
- **Access control:** Role-based access to production environment configurations

## Milestones and sequencing

### Project estimate
- **Total timeline:** 6-8 months for MVP launch with Render-first development
- **Team size:** 4-6 developers, 1 designer, 1 product manager (DevOps handled by Render)
- **Budget considerations:** Development resources, Render hosting costs, third-party service costs
- **Infrastructure advantages:** No DevOps overhead, automated scaling, managed services
- **Development efficiency:** Faster iteration with staging environment, no local setup complexity

### Phase 1: Foundation and deployment setup (Weeks 1-8)
- Render staging environment setup with PostgreSQL and Redis services
- Environment groups configuration for shared secrets and variables
- GitHub repository setup with automated Render deployment
- Webhook endpoint deployment (REQUIRED before Traveltek registration)
- Database design and initial schema implementation on Render staging
- Clerk authentication integration and user management
- Basic web application framework and routing
- Staging environment validation and testing procedures

### Phase 2: Data integration (Weeks 6-12)
- Traveltek registration with deployed webhook URL (https://[staging-app].onrender.com/api/webhooks/traveltek)
- Traveltek API integration and FTP connection setup on Render
- Data processing pipeline for JSON files using Render background workers
- Database population and data validation systems on staging environment
- Redis caching implementation using Render managed Redis
- Basic search functionality development and testing on staging

### Phase 3: Core features (Weeks 10-16)
- Cruise search and filtering system
- Cruise detail pages with comprehensive information
- Quote request system and form implementation
- Email integration with Resend service
- Responsive UI development and testing

### Phase 4: Enhancement and optimization (Weeks 14-20)
- Advanced search features and performance optimization on staging
- Analytics integration with PostHog for staging environment tracking
- Sentry error tracking and monitoring setup for both environments
- User experience refinements and A/B testing on staging
- Quality assurance and bug fixing using Render staging environment
- Production environment preparation and configuration

### Phase 5: Launch preparation (Weeks 18-24)
- Performance testing and optimization on Render staging
- Security testing and compliance verification
- Production environment deployment from validated staging
- Content creation and SEO optimization
- Marketing integration and conversion tracking setup
- Staging-to-production promotion procedures and validation

### Phase 6: Launch and iteration (Weeks 22-28)
- Public launch and marketing campaigns
- User feedback analysis and rapid iterations
- Performance monitoring and optimization
- Feature enhancements based on user behavior
- Scale preparation for growth

## User stories

### US-001: Guest user cruise search
**Title:** Basic cruise search functionality  
**Description:** As a guest user, I want to search for cruises by destination and dates so that I can find relevant cruise options for my travel plans.  
**Acceptance criteria:**
- User can enter destination (region, specific ports, or "anywhere")
- User can select departure date range (specific dates or flexible)
- User can optionally specify cruise length preferences
- Search returns relevant results within 3 seconds
- Results display includes basic cruise information (ship, cruise line, duration, starting price)
- User can search without creating an account

### US-002: Advanced cruise filtering
**Title:** Filter and sort cruise search results  
**Description:** As a user, I want to filter and sort my cruise search results so that I can narrow down options based on my preferences.  
**Acceptance criteria:**
- Filter options include: price range, cruise line, ship, departure port, cabin type, duration
- Sorting options include: price (low to high, high to low), departure date, duration, popularity
- Filters can be combined and applied dynamically
- Filter state is maintained when navigating between pages
- Clear indication of active filters with easy removal option
- Results update immediately when filters are applied

### US-003: Cruise detail information
**Title:** Comprehensive cruise detail page  
**Description:** As a user, I want to view detailed information about a specific cruise so that I can make an informed decision about booking.  
**Acceptance criteria:**
- Page displays complete itinerary with port details and times
- Ship information includes amenities, dining options, entertainment, and deck plans
- Cabin categories with descriptions, images, and pricing tiers
- Photo gallery with ship and destination images
- Pricing information clearly shows base price and available onboard credit
- Reviews and ratings if available
- "Request Quote" call-to-action prominently displayed

### US-004: Quote request submission
**Title:** Multi-step quote request process  
**Description:** As a user, I want to request a quote for a specific cruise so that I can receive personalized pricing and book my vacation.  
**Acceptance criteria:**
- Form captures essential information: traveler count, cabin preferences, special requirements
- Contact information collection with validation
- Travel insurance and dining package option selection
- Form validation with clear error messages
- Progress indicator for multi-step process
- Option to save progress and complete later for registered users
- Confirmation page with request details and next steps
- Automated confirmation email sent within 5 minutes

### US-005: User account registration
**Title:** Create user account via Clerk  
**Description:** As a visitor, I want to create an account so that I can save my preferences and track my quote requests.  
**Acceptance criteria:**
- Registration available via email/password or social login options
- Email verification required before account activation
- User profile creation with travel preferences
- Communication preferences setting (email frequency, types)
- Integration with Clerk authentication system
- Secure password requirements and validation
- Welcome email sequence initiated upon registration

### US-006: User account management
**Title:** Manage account settings and preferences  
**Description:** As a registered user, I want to manage my account settings so that I can control my experience and communications.  
**Acceptance criteria:**
- Edit profile information and travel preferences
- Manage email communication preferences
- View and update contact information
- Change password with proper validation
- Delete account option with confirmation process
- Privacy settings and data export options
- Integration with Clerk user management

### US-007: Quote request tracking
**Title:** Track quote request status  
**Description:** As a registered user, I want to track the status of my quote requests so that I know when to expect responses and can follow up appropriately.  
**Acceptance criteria:**
- Dashboard showing all quote requests with status indicators
- Status categories: submitted, in review, quote ready, expired
- Email notifications for status changes
- Detailed view of each quote request with original specifications
- Ability to modify or cancel pending requests
- Quote expiration dates clearly displayed
- Direct communication thread for each quote request

### US-008: Saved searches and alerts
**Title:** Save searches and receive price alerts  
**Description:** As a registered user, I want to save my searches and receive alerts about price changes so that I can find the best deals.  
**Acceptance criteria:**
- Save search criteria with custom names
- Set up price drop alerts with threshold amounts
- Email notifications when saved searches have new results
- Manage saved searches from user dashboard
- Weekly digest of saved search results
- Alert frequency preferences (immediate, daily, weekly)
- Easy unsubscribe from specific alerts

### US-009: Cruise comparison tool
**Title:** Compare multiple cruises side-by-side  
**Description:** As a user, I want to compare multiple cruises directly so that I can evaluate options more efficiently.  
**Acceptance criteria:**
- Add cruises to comparison from search results or detail pages
- Side-by-side comparison of key features: price, itinerary, amenities, onboard credit
- Compare up to 4 cruises simultaneously
- Highlight differences between compared cruises
- Remove cruises from comparison easily
- Share comparison via email or direct link
- Request quotes for multiple compared cruises at once

### US-010: Mobile responsive experience
**Title:** Optimized mobile user experience  
**Description:** As a mobile user, I want the full functionality available on desktop so that I can search and request quotes from any device.  
**Acceptance criteria:**
- All search and filtering functionality works on mobile devices
- Touch-optimized interface with appropriate button sizes
- Responsive layout adapts to different screen sizes
- Fast loading times on mobile connections
- Swipeable image galleries and intuitive navigation
- Mobile-optimized forms with proper input types
- Offline capability for viewing previously loaded cruise details

### US-011: Administrative quote management
**Title:** Process and respond to quote requests  
**Description:** As an admin user, I want to manage incoming quote requests so that I can provide timely responses to potential customers.  
**Acceptance criteria:**
- Dashboard view of all quote requests with filtering and sorting
- Detailed view of each request with customer information and preferences
- Status management system for tracking quote progress
- Internal notes and communication tracking
- Integration with external booking systems
- Automated follow-up email scheduling
- Performance metrics and reporting for quote processing

### US-012: Data synchronization system
**Title:** Automated Traveltek data updates on Render  
**Description:** As a system administrator, I want automated data synchronization from Traveltek using Render's infrastructure so that cruise information stays current and accurate.  
**Acceptance criteria:**
- Webhook endpoint deployed on Render BEFORE Traveltek registration
- Webhook URL format: https://[app-name].onrender.com/api/webhooks/traveltek
- Scheduled FTP connection to Traveltek servers using Render background workers
- Automated download and processing of JSON data files on Render staging
- Data validation and error handling using Render managed PostgreSQL
- Historical data retention for price tracking in staging and production databases
- Real-time webhook integration validated on staging before production
- Monitoring and alerting for sync failures through Sentry on both environments
- Data backup through Render's automated PostgreSQL backup system

### US-013: Performance optimization
**Title:** Fast search and browsing experience on Render  
**Description:** As a user, I want fast page loads and search responses so that I can efficiently browse cruise options.  
**Acceptance criteria:**
- Search results load in under 2 seconds on Render staging and production
- Page transitions are smooth leveraging Render's CDN
- Images load progressively without blocking content
- Render managed Redis reduces database queries for common searches
- Optimized database indexes for search queries in PostgreSQL
- Static asset delivery through Render's integrated CDN
- Performance validated on staging before production deployment
- Auto-scaling capabilities handle traffic spikes automatically

### US-014: Analytics and tracking
**Title:** User behavior tracking and analysis  
**Description:** As a product manager, I want comprehensive analytics so that I can understand user behavior and optimize the platform.  
**Acceptance criteria:**
- PostHog integration tracks all user interactions
- Conversion funnel analysis for search-to-quote flow
- A/B testing capabilities for key user interface elements
- Custom event tracking for business-specific metrics
- User segmentation based on behavior and preferences
- Real-time dashboard for key performance indicators
- Privacy-compliant data collection and storage

### US-015: Error handling and monitoring
**Title:** Comprehensive error tracking across Render environments  
**Description:** As a developer, I want detailed error tracking across staging and production so that I can quickly identify and resolve issues affecting users.  
**Acceptance criteria:**
- Sentry integration captures errors on both Render staging and production
- Environment-specific error categorization and alerting
- Real-time alerting for critical errors in production environment
- Error context includes Render environment information and deployment details
- Performance monitoring identifies slow queries in managed PostgreSQL
- Staging error analysis prevents production issues
- Integration with GitHub workflow for issue tracking and resolution
- User-friendly error messages with environment-appropriate recovery options

### US-016: Email communication system
**Title:** Automated and transactional email delivery  
**Description:** As a user, I want to receive timely email communications about my quotes and account activity so that I stay informed about my cruise planning.  
**Acceptance criteria:**
- Quote request confirmations sent within 5 minutes
- Status update emails for quote processing milestones
- Marketing emails based on user preferences and behavior
- Email template management with consistent branding
- Delivery tracking and bounce handling
- Unsubscribe management with granular preferences
- Integration with Resend service for reliable delivery

### US-017: Search engine optimization
**Title:** Optimized content for search discovery  
**Description:** As a marketing manager, I want the platform optimized for search engines so that potential customers can discover our cruise deals organically.  
**Acceptance criteria:**
- SEO-friendly URLs for all cruise and destination pages
- Meta descriptions and titles optimized for cruise-related keywords
- Structured data markup for cruise information
- XML sitemap generation and submission
- Page speed optimization for search ranking factors
- Mobile-first indexing compatibility
- Content strategy for cruise destination and ship information

### US-018: Security and compliance
**Title:** Secure user data and privacy compliance  
**Description:** As a user, I want my personal information protected and handled in compliance with privacy regulations so that I can trust the platform with my data.  
**Acceptance criteria:**
- HTTPS encryption for all data transmission
- GDPR compliance with cookie consent and data export options
- CCPA compliance with data deletion and opt-out capabilities
- Secure API endpoints with proper authentication
- Regular security audits and vulnerability assessments
- Data breach response procedures and notifications
- PCI compliance for payment information handling (future phase)

### US-019: Content management system
**Title:** Manage cruise and destination content  
**Description:** As a content administrator, I want to manage cruise descriptions and destination information so that users have accurate and engaging content.  
**Acceptance criteria:**
- Admin interface for editing cruise descriptions and highlights
- Destination content management with images and travel tips
- Blog content creation for SEO and user engagement
- Content approval workflow for quality control
- Image management and optimization tools
- Content scheduling and publication management
- Analytics on content performance and user engagement

### US-020: Customer support integration
**Title:** Integrated customer support system  
**Description:** As a customer service representative, I want access to user information and quote history so that I can provide effective support.  
**Acceptance criteria:**
- Support dashboard with user account information
- Quote request history and status for customer inquiries
- Internal note system for tracking support interactions
- Integration with help desk software or live chat tools
- Escalation procedures for complex booking issues
- Knowledge base integration for common questions
- Support ticket tracking and resolution metrics

### US-021: Webhook deployment prerequisite
**Title:** Deploy webhook endpoint before Traveltek registration  
**Description:** As a system administrator, I need to deploy the webhook endpoint on Render staging before registering with Traveltek so that the integration can be properly configured.  
**Acceptance criteria:**
- Webhook endpoint deployed to Render staging environment first
- URL format confirmed: https://[staging-app].onrender.com/api/webhooks/traveltek
- Endpoint responds with proper HTTP status codes for health checks
- SSL certificate validated and secure connection confirmed
- Webhook endpoint tested with mock data before Traveltek registration
- Staging environment fully functional before providing URL to Traveltek
- Documentation created for webhook endpoint specifications and requirements
- Production webhook URL prepared: https://[production-app].onrender.com/api/webhooks/traveltek

### US-022: Render environment configuration
**Title:** Configure Render environment groups and services  
**Description:** As a DevOps administrator, I want to properly configure Render environment groups so that both staging and production have consistent and secure configuration management.  
**Acceptance criteria:**
- Staging environment group created with development-appropriate configurations
- Production environment group created with secure production settings
- PostgreSQL and Redis services linked to appropriate environment groups
- All sensitive data (API keys, database credentials) managed through Render dashboard
- No hardcoded secrets in application code or repository
- Environment variable naming consistency between staging and production
- Access controls configured for production environment management
- Backup and monitoring configured for both database instances