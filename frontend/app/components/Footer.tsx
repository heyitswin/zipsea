'use client';
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-white py-8 md:py-16">
      <div className="max-w-7xl mx-auto px-8">
        {/* Mobile Layout - Stack vertically */}
        <div className="md:hidden">
          {/* Social Icons - Top on mobile */}
          <div className="flex justify-center gap-4 mb-8">
            {/* TikTok Icon */}
            <a 
              href="https://www.tiktok.com/@zipseacruises"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <svg width="45" height="45" viewBox="0 0 45 45" fill="none" style={{ shapeRendering: 'geometricPrecision' }}>
                <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F"/>
                <path d="M29.5162 16.3304C29.3707 16.2552 29.229 16.1727 29.0917 16.0834C28.6925 15.8194 28.3264 15.5084 28.0015 15.1571C27.1884 14.2267 26.8847 13.2829 26.7729 12.6221H26.7774C26.6839 12.0736 26.7226 11.7188 26.7284 11.7188H23.025V26.0389C23.025 26.2312 23.025 26.4212 23.0169 26.609C23.0169 26.6324 23.0147 26.6539 23.0134 26.6791C23.0134 26.6894 23.0134 26.7002 23.0111 26.711C23.0111 26.7137 23.0111 26.7164 23.0111 26.7191C22.9721 27.2329 22.8074 27.7292 22.5315 28.1644C22.2556 28.5996 21.877 28.9604 21.429 29.2149C20.962 29.4806 20.4339 29.6199 19.8967 29.6192C18.1712 29.6192 16.7728 28.2123 16.7728 26.4747C16.7728 24.7371 18.1712 23.3302 19.8967 23.3302C20.2233 23.3299 20.5479 23.3813 20.8584 23.4824L20.8629 19.7117C19.9202 19.5899 18.9624 19.6648 18.0501 19.9317C17.1378 20.1986 16.2906 20.6517 15.5622 21.2624C14.9238 21.817 14.3872 22.4788 13.9764 23.2179C13.8201 23.4874 13.2303 24.5704 13.1588 26.3282C13.1139 27.326 13.4135 28.3596 13.5564 28.7868V28.7958C13.6462 29.0474 13.9944 29.9058 14.5617 30.6295C15.0193 31.21 15.5598 31.72 16.1659 32.1429V32.1339L16.1749 32.1429C17.9677 33.3612 19.9555 33.2812 19.9555 33.2812C20.2996 33.2673 21.4523 33.2812 22.7613 32.6609C24.2132 31.9731 25.0398 30.9485 25.0398 30.9485C25.5678 30.3362 25.9877 29.6385 26.2814 28.8852C26.6165 28.0043 26.7284 26.9477 26.7284 26.5254V18.9283C26.7733 18.9552 27.3717 19.351 27.3717 19.351C27.3717 19.351 28.2337 19.9035 29.5787 20.2633C30.5436 20.5194 31.8436 20.5733 31.8436 20.5733V16.8969C31.3881 16.9463 30.4632 16.8026 29.5162 16.3304Z" fill="white"/>
              </svg>
            </a>
            
            {/* Instagram Icon */}
            <a 
              href="https://www.instagram.com/zipseacruises/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <svg width="45" height="45" viewBox="0 0 45 45" fill="none" style={{ shapeRendering: 'geometricPrecision' }}>
                <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F"/>
                <g clipPath="url(#clip0_footer_instagram)">
                  <path d="M23 13.163C26.204 13.163 26.584 13.175 27.85 13.233C31.102 13.381 32.621 14.924 32.769 18.152C32.827 19.417 32.838 19.797 32.838 23.001C32.838 26.206 32.826 26.585 32.769 27.85C32.62 31.075 31.105 32.621 27.85 32.769C26.584 32.827 26.206 32.839 23 32.839C19.796 32.839 19.416 32.827 18.151 32.769C14.891 32.62 13.38 31.07 13.232 27.849C13.174 26.584 13.162 26.205 13.162 23C13.162 19.796 13.175 19.417 13.232 18.151C13.381 14.924 14.896 13.38 18.151 13.232C19.417 13.175 19.796 13.163 23 13.163ZM23 11C19.741 11 19.333 11.014 18.053 11.072C13.695 11.272 11.273 13.69 11.073 18.052C11.014 19.333 11 19.741 11 23C11 26.259 11.014 26.668 11.072 27.948C11.272 32.306 13.69 34.728 18.052 34.928C19.333 34.986 19.741 35 23 35C26.259 35 26.668 34.986 27.948 34.928C32.302 34.728 34.73 32.31 34.927 27.948C34.986 26.668 35 26.259 35 23C35 19.741 34.986 19.333 34.928 18.053C34.732 13.699 32.311 11.273 27.949 11.073C26.668 11.014 26.259 11 23 11ZM23 16.838C19.597 16.838 16.838 19.597 16.838 23C16.838 26.403 19.597 29.163 23 29.163C26.403 29.163 29.162 26.404 29.162 23C29.162 19.597 26.403 16.838 23 16.838ZM23 27C20.791 27 19 25.21 19 23C19 20.791 20.791 19 23 19C25.209 19 27 20.791 27 23C27 25.21 25.209 27 23 27ZM29.406 15.155C28.61 15.155 27.965 15.8 27.965 16.595C27.965 17.39 28.61 18.035 29.406 18.035C30.201 18.035 30.845 17.39 30.845 16.595C30.845 15.8 30.201 15.155 29.406 15.155Z" fill="white"/>
                </g>
                <defs>
                  <clipPath id="clip0_footer_instagram">
                    <rect width="24" height="24" fill="white" transform="translate(11 11)"/>
                  </clipPath>
                </defs>
              </svg>
            </a>
          </div>

          {/* Navigation Links - Stacked vertically on mobile */}
          <div className="flex flex-col space-y-6 mb-8">
            <a 
              href="/why-zipsea" 
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: '18px',
                color: '#2f2f2f',
                letterSpacing: '-0.02em'
              }}
            >
              Why Zipsea
            </a>
            
            <a 
              href="/faqs" 
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: '18px',
                color: '#2f2f2f',
                letterSpacing: '-0.02em'
              }}
            >
              FAQs
            </a>
            
            <a 
              href="#" 
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: '18px',
                color: '#2f2f2f',
                letterSpacing: '-0.02em'
              }}
            >
              Chat with us
            </a>
          </div>

          {/* Logo and legal links - Bottom on mobile */}
          <div className="flex flex-col items-center space-y-4">
            <div>
              <a href="/">
                <Image
                  src="/images/zipsea-logo.svg"
                  alt="Zipsea"
                  width={110}
                  height={40}
                  className="brightness-0 w-[83px] md:w-[110px] h-auto"
                  style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(89%)' }}
                />
              </a>
            </div>
            
            <div className="flex space-x-6">
              <a 
                href="#" 
                className="font-geograph font-bold"
                style={{
                  fontSize: '9px',
                  color: '#2f2f2f',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }}
              >
                TERMS & CONDITIONS
              </a>
              
              <a 
                href="#" 
                className="font-geograph font-bold"
                style={{
                  fontSize: '9px',
                  color: '#2f2f2f',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }}
              >
                PRIVACY POLICY
              </a>
            </div>
          </div>
        </div>

        {/* Desktop Layout - Original horizontal layout */}
        <div className="hidden md:flex justify-between items-start">
          {/* Left side - Logo and links */}
          <div className="flex flex-col">
            {/* Zipsea Logo */}
            <div className="mb-6">
              <a href="/">
                <Image
                  src="/images/zipsea-logo.svg"
                  alt="Zipsea"
                  width={110}
                  height={40}
                  className="brightness-0"
                  style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(89%)' }}
                />
              </a>
            </div>
            
            {/* Terms & Conditions Link */}
            <a 
              href="#" 
              className="font-geograph font-bold mb-3"
              style={{
                fontSize: '9px',
                color: '#2f2f2f',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            >
              TERMS & CONDITIONS
            </a>
            
            {/* Privacy Policy Link */}
            <a 
              href="#" 
              className="font-geograph font-bold"
              style={{
                fontSize: '9px',
                color: '#2f2f2f',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            >
              PRIVACY POLICY
            </a>
          </div>
          
          {/* Right side - Navigation links and social icons */}
          <div className="flex items-center gap-8">
            {/* Navigation Links */}
            <div className="flex items-center gap-8">
              {/* Why Zipsea */}
              <a 
                href="/why-zipsea" 
                className="font-geograph font-medium hover:opacity-80 transition-opacity"
                style={{
                  fontSize: '16px',
                  color: '#2f2f2f',
                  letterSpacing: '-0.02em'
                }}
              >
                Why Zipsea
              </a>
              
              {/* FAQs */}
              <a 
                href="/faqs" 
                className="font-geograph font-medium hover:opacity-80 transition-opacity"
                style={{
                  fontSize: '16px',
                  color: '#2f2f2f',
                  letterSpacing: '-0.02em'
                }}
              >
                FAQs
              </a>
              
              {/* Chat with us */}
              <a 
                href="#" 
                className="font-geograph font-medium hover:opacity-80 transition-opacity"
                style={{
                  fontSize: '16px',
                  color: '#2f2f2f',
                  letterSpacing: '-0.02em'
                }}
              >
                Chat with us
              </a>
            </div>
            
            {/* Social Icons with reduced spacing */}
            <div className="flex items-center gap-4">
              {/* TikTok Icon */}
              <a 
                href="https://www.tiktok.com/@zipseacruises"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                <svg width="45" height="45" viewBox="0 0 45 45" fill="none" style={{ shapeRendering: 'geometricPrecision' }}>
                  <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F"/>
                  <path d="M29.5162 16.3304C29.3707 16.2552 29.229 16.1727 29.0917 16.0834C28.6925 15.8194 28.3264 15.5084 28.0015 15.1571C27.1884 14.2267 26.8847 13.2829 26.7729 12.6221H26.7774C26.6839 12.0736 26.7226 11.7188 26.7284 11.7188H23.025V26.0389C23.025 26.2312 23.025 26.4212 23.0169 26.609C23.0169 26.6324 23.0147 26.6539 23.0134 26.6791C23.0134 26.6894 23.0134 26.7002 23.0111 26.711C23.0111 26.7137 23.0111 26.7164 23.0111 26.7191C22.9721 27.2329 22.8074 27.7292 22.5315 28.1644C22.2556 28.5996 21.877 28.9604 21.429 29.2149C20.962 29.4806 20.4339 29.6199 19.8967 29.6192C18.1712 29.6192 16.7728 28.2123 16.7728 26.4747C16.7728 24.7371 18.1712 23.3302 19.8967 23.3302C20.2233 23.3299 20.5479 23.3813 20.8584 23.4824L20.8629 19.7117C19.9202 19.5899 18.9624 19.6648 18.0501 19.9317C17.1378 20.1986 16.2906 20.6517 15.5622 21.2624C14.9238 21.817 14.3872 22.4788 13.9764 23.2179C13.8201 23.4874 13.2303 24.5704 13.1588 26.3282C13.1139 27.326 13.4135 28.3596 13.5564 28.7868V28.7958C13.6462 29.0474 13.9944 29.9058 14.5617 30.6295C15.0193 31.21 15.5598 31.72 16.1659 32.1429V32.1339L16.1749 32.1429C17.9677 33.3612 19.9555 33.2812 19.9555 33.2812C20.2996 33.2673 21.4523 33.2812 22.7613 32.6609C24.2132 31.9731 25.0398 30.9485 25.0398 30.9485C25.5678 30.3362 25.9877 29.6385 26.2814 28.8852C26.6165 28.0043 26.7284 26.9477 26.7284 26.5254V18.9283C26.7733 18.9552 27.3717 19.351 27.3717 19.351C27.3717 19.351 28.2337 19.9035 29.5787 20.2633C30.5436 20.5194 31.8436 20.5733 31.8436 20.5733V16.8969C31.3881 16.9463 30.4632 16.8026 29.5162 16.3304Z" fill="white"/>
                </svg>
              </a>
              
              {/* Instagram Icon */}
              <a 
                href="https://www.instagram.com/zipseacruises/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
              >
                <svg width="45" height="45" viewBox="0 0 45 45" fill="none" style={{ shapeRendering: 'geometricPrecision' }}>
                  <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F"/>
                  <g clipPath="url(#clip0_footer_instagram)">
                    <path d="M23 13.163C26.204 13.163 26.584 13.175 27.85 13.233C31.102 13.381 32.621 14.924 32.769 18.152C32.827 19.417 32.838 19.797 32.838 23.001C32.838 26.206 32.826 26.585 32.769 27.85C32.62 31.075 31.105 32.621 27.85 32.769C26.584 32.827 26.206 32.839 23 32.839C19.796 32.839 19.416 32.827 18.151 32.769C14.891 32.62 13.38 31.07 13.232 27.849C13.174 26.584 13.162 26.205 13.162 23C13.162 19.796 13.175 19.417 13.232 18.151C13.381 14.924 14.896 13.38 18.151 13.232C19.417 13.175 19.796 13.163 23 13.163ZM23 11C19.741 11 19.333 11.014 18.053 11.072C13.695 11.272 11.273 13.69 11.073 18.052C11.014 19.333 11 19.741 11 23C11 26.259 11.014 26.668 11.072 27.948C11.272 32.306 13.69 34.728 18.052 34.928C19.333 34.986 19.741 35 23 35C26.259 35 26.668 34.986 27.948 34.928C32.302 34.728 34.73 32.31 34.927 27.948C34.986 26.668 35 26.259 35 23C35 19.741 34.986 19.333 34.928 18.053C34.732 13.699 32.311 11.273 27.949 11.073C26.668 11.014 26.259 11 23 11ZM23 16.838C19.597 16.838 16.838 19.597 16.838 23C16.838 26.403 19.597 29.163 23 29.163C26.403 29.163 29.162 26.404 29.162 23C29.162 19.597 26.403 16.838 23 16.838ZM23 27C20.791 27 19 25.21 19 23C19 20.791 20.791 19 23 19C25.209 19 27 20.791 27 23C27 25.21 25.209 27 23 27ZM29.406 15.155C28.61 15.155 27.965 15.8 27.965 16.595C27.965 17.39 28.61 18.035 29.406 18.035C30.201 18.035 30.845 17.39 30.845 16.595C30.845 15.8 30.201 15.155 29.406 15.155Z" fill="white"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_footer_instagram">
                      <rect width="24" height="24" fill="white" transform="translate(11 11)"/>
                    </clipPath>
                  </defs>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}