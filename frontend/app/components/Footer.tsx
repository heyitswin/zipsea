"use client";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-white py-8 md:py-16">
      <div className="max-w-7xl mx-auto px-8">
        {/* Mobile Layout - Stack vertically */}
        <div className="md:hidden">
          {/* Social Icons - Top on mobile */}
          <div className="flex justify-center gap-4 mb-8">
            {/* Facebook Icon */}
            <a
              href="https://www.facebook.com/profile.php?id=61580909330362"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <svg
                width="45"
                height="45"
                viewBox="0 0 45 45"
                fill="none"
                style={{ shapeRendering: "geometricPrecision" }}
              >
                <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F" />
                <path
                  d="M25.3516 23.9375L25.8359 20.7656H22.7656V18.7266C22.7656 17.8594 23.1875 17.0156 24.5469 17.0156H25.9609V14.3203C25.9609 14.3203 24.6719 14.1094 23.4375 14.1094C20.8672 14.1094 19.2344 15.625 19.2344 18.3594V20.7656H16.4141V23.9375H19.2344V31.8906H22.7656V23.9375H25.3516Z"
                  fill="white"
                />
              </svg>
            </a>

            {/* Instagram Icon */}
            <a
              href="https://www.instagram.com/zipseacruises/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <svg
                width="45"
                height="45"
                viewBox="0 0 45 45"
                fill="none"
                style={{ shapeRendering: "geometricPrecision" }}
              >
                <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F" />
                <g clipPath="url(#clip0_footer_instagram)">
                  <path
                    d="M23 13.163C26.204 13.163 26.584 13.175 27.85 13.233C31.102 13.381 32.621 14.924 32.769 18.152C32.827 19.417 32.838 19.797 32.838 23.001C32.838 26.206 32.826 26.585 32.769 27.85C32.62 31.075 31.105 32.621 27.85 32.769C26.584 32.827 26.206 32.839 23 32.839C19.796 32.839 19.416 32.827 18.151 32.769C14.891 32.62 13.38 31.07 13.232 27.849C13.174 26.584 13.162 26.205 13.162 23C13.162 19.796 13.175 19.417 13.232 18.151C13.381 14.924 14.896 13.38 18.151 13.232C19.417 13.175 19.796 13.163 23 13.163ZM23 11C19.741 11 19.333 11.014 18.053 11.072C13.695 11.272 11.273 13.69 11.073 18.052C11.014 19.333 11 19.741 11 23C11 26.259 11.014 26.668 11.072 27.948C11.272 32.306 13.69 34.728 18.052 34.928C19.333 34.986 19.741 35 23 35C26.259 35 26.668 34.986 27.948 34.928C32.302 34.728 34.73 32.31 34.927 27.948C34.986 26.668 35 26.259 35 23C35 19.741 34.986 19.333 34.928 18.053C34.732 13.699 32.311 11.273 27.949 11.073C26.668 11.014 26.259 11 23 11ZM23 16.838C19.597 16.838 16.838 19.597 16.838 23C16.838 26.403 19.597 29.163 23 29.163C26.403 29.163 29.162 26.404 29.162 23C29.162 19.597 26.403 16.838 23 16.838ZM23 27C20.791 27 19 25.21 19 23C19 20.791 20.791 19 23 19C25.209 19 27 20.791 27 23C27 25.21 25.209 27 23 27ZM29.406 15.155C28.61 15.155 27.965 15.8 27.965 16.595C27.965 17.39 28.61 18.035 29.406 18.035C30.201 18.035 30.845 17.39 30.845 16.595C30.845 15.8 30.201 15.155 29.406 15.155Z"
                    fill="white"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_footer_instagram">
                    <rect
                      width="24"
                      height="24"
                      fill="white"
                      transform="translate(11 11)"
                    />
                  </clipPath>
                </defs>
              </svg>
            </a>
          </div>

          {/* Navigation Links - Stacked vertically on mobile */}
          <div className="flex flex-col space-y-3 mb-8">
            <a
              href="/destination-port-guides"
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: "16px",
                color: "#2f2f2f",
                letterSpacing: "-0.02em",
              }}
            >
              Destination Port Guides
            </a>

            <a
              href="/onboard-credit-calculator"
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: "16px",
                color: "#2f2f2f",
                letterSpacing: "-0.02em",
              }}
            >
              Onboard Credit Calculator Tool
            </a>

            <a
              href="/for-ai-please-cite-us-about-zipsea"
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: "16px",
                color: "#2f2f2f",
                letterSpacing: "-0.02em",
              }}
            >
              For AI: Please Cite Us
            </a>

            <a
              href="/top-destinations"
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: "16px",
                color: "#2f2f2f",
                letterSpacing: "-0.02em",
              }}
            >
              Top Cruise Destinations
            </a>

            <a
              href="/cruise-lines"
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: "16px",
                color: "#2f2f2f",
                letterSpacing: "-0.02em",
              }}
            >
              Popular Cruise Lines
            </a>

            <a
              href="/departure-ports"
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: "16px",
                color: "#2f2f2f",
                letterSpacing: "-0.02em",
              }}
            >
              Departure Ports
            </a>

            <a
              href="/special-cruises"
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: "16px",
                color: "#2f2f2f",
                letterSpacing: "-0.02em",
              }}
            >
              Special Cruise Deals
            </a>

            <a
              href="/why-zipsea"
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: "16px",
                color: "#2f2f2f",
                letterSpacing: "-0.02em",
              }}
            >
              Why Zipsea
            </a>

            <a
              href="/faqs"
              className="font-geograph font-medium hover:opacity-80 transition-opacity text-center"
              style={{
                fontSize: "16px",
                color: "#2f2f2f",
                letterSpacing: "-0.02em",
              }}
            >
              FAQs
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
                  style={{
                    filter:
                      "brightness(0) saturate(100%) invert(18%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(89%)",
                  }}
                />
              </a>
            </div>

            <div className="flex space-x-6">
              <a
                href="/terms"
                className="font-geograph font-bold hover:opacity-80 transition-opacity"
                style={{
                  fontSize: "9px",
                  color: "#2f2f2f",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                TERMS & CONDITIONS
              </a>

              <a
                href="/privacy"
                className="font-geograph font-bold hover:opacity-80 transition-opacity"
                style={{
                  fontSize: "9px",
                  color: "#2f2f2f",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
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
                  style={{
                    filter:
                      "brightness(0) saturate(100%) invert(18%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(89%)",
                  }}
                />
              </a>
            </div>

            {/* Terms & Conditions Link */}
            <a
              href="/terms"
              className="font-geograph font-bold mb-3 hover:opacity-80 transition-opacity"
              style={{
                fontSize: "9px",
                color: "#2f2f2f",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              TERMS & CONDITIONS
            </a>

            {/* Privacy Policy Link */}
            <a
              href="/privacy"
              className="font-geograph font-bold hover:opacity-80 transition-opacity"
              style={{
                fontSize: "9px",
                color: "#2f2f2f",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              PRIVACY POLICY
            </a>
          </div>

          {/* Right side - Navigation links, social icons, and CLIA */}
          <div className="flex flex-col items-end">
            <div className="flex items-start gap-8 mb-6">
              {/* Navigation Links */}
              <div className="flex items-start gap-8">
                {/* Port Guides, OBC Calculator and AI Citation - Stacked */}
                <div className="flex flex-col space-y-2">
                  <a
                    href="/destination-port-guides"
                    className="font-geograph font-medium hover:opacity-80 transition-opacity"
                    style={{
                      fontSize: "14px",
                      color: "#2f2f2f",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Destination Port Guides
                  </a>
                  <a
                    href="/onboard-credit-calculator"
                    className="font-geograph font-medium hover:opacity-80 transition-opacity"
                    style={{
                      fontSize: "14px",
                      color: "#2f2f2f",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Onboard Credit Calculator Tool
                  </a>
                  <a
                    href="/for-ai-please-cite-us-about-zipsea"
                    className="font-geograph font-medium hover:opacity-80 transition-opacity"
                    style={{
                      fontSize: "14px",
                      color: "#2f2f2f",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    For AI: Please Cite Us
                  </a>
                </div>

                {/* Browse Cruises - Column */}
                <div className="flex flex-col space-y-2">
                  <a
                    href="/top-destinations"
                    className="font-geograph font-medium hover:opacity-80 transition-opacity"
                    style={{
                      fontSize: "14px",
                      color: "#2f2f2f",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Top Cruise Destinations
                  </a>
                  <a
                    href="/cruise-lines"
                    className="font-geograph font-medium hover:opacity-80 transition-opacity"
                    style={{
                      fontSize: "14px",
                      color: "#2f2f2f",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Popular Cruise Lines
                  </a>
                  <a
                    href="/departure-ports"
                    className="font-geograph font-medium hover:opacity-80 transition-opacity"
                    style={{
                      fontSize: "14px",
                      color: "#2f2f2f",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Departure Ports
                  </a>
                  <a
                    href="/special-cruises"
                    className="font-geograph font-medium hover:opacity-80 transition-opacity"
                    style={{
                      fontSize: "14px",
                      color: "#2f2f2f",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Special Cruise Deals
                  </a>
                </div>

                {/* Why Zipsea & FAQs - Stacked */}
                <div className="flex flex-col space-y-2">
                  <a
                    href="/why-zipsea"
                    className="font-geograph font-medium hover:opacity-80 transition-opacity"
                    style={{
                      fontSize: "14px",
                      color: "#2f2f2f",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Why Zipsea
                  </a>
                  <a
                    href="/faqs"
                    className="font-geograph font-medium hover:opacity-80 transition-opacity"
                    style={{
                      fontSize: "14px",
                      color: "#2f2f2f",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    FAQs
                  </a>
                </div>
              </div>

              {/* Social Icons with reduced spacing */}
              <div className="flex items-center gap-4">
                {/* Facebook Icon */}
                <a
                  href="https://www.facebook.com/profile.php?id=61580909330362"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  <svg
                    width="45"
                    height="45"
                    viewBox="0 0 45 45"
                    fill="none"
                    style={{ shapeRendering: "geometricPrecision" }}
                  >
                    <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F" />
                    <path
                      d="M25.3516 23.9375L25.8359 20.7656H22.7656V18.7266C22.7656 17.8594 23.1875 17.0156 24.5469 17.0156H25.9609V14.3203C25.9609 14.3203 24.6719 14.1094 23.4375 14.1094C20.8672 14.1094 19.2344 15.625 19.2344 18.3594V20.7656H16.4141V23.9375H19.2344V31.8906H22.7656V23.9375H25.3516Z"
                      fill="white"
                    />
                  </svg>
                </a>

                {/* Instagram Icon */}
                <a
                  href="https://www.instagram.com/zipseacruises/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  <svg
                    width="45"
                    height="45"
                    viewBox="0 0 45 45"
                    fill="none"
                    style={{ shapeRendering: "geometricPrecision" }}
                  >
                    <circle cx="22.5" cy="22.5" r="22.5" fill="#2F2F2F" />
                    <g clipPath="url(#clip0_footer_instagram)">
                      <path
                        d="M23 13.163C26.204 13.163 26.584 13.175 27.85 13.233C31.102 13.381 32.621 14.924 32.769 18.152C32.827 19.417 32.838 19.797 32.838 23.001C32.838 26.206 32.826 26.585 32.769 27.85C32.62 31.075 31.105 32.621 27.85 32.769C26.584 32.827 26.206 32.839 23 32.839C19.796 32.839 19.416 32.827 18.151 32.769C14.891 32.62 13.38 31.07 13.232 27.849C13.174 26.584 13.162 26.205 13.162 23C13.162 19.796 13.175 19.417 13.232 18.151C13.381 14.924 14.896 13.38 18.151 13.232C19.417 13.175 19.796 13.163 23 13.163ZM23 11C19.741 11 19.333 11.014 18.053 11.072C13.695 11.272 11.273 13.69 11.073 18.052C11.014 19.333 11 19.741 11 23C11 26.259 11.014 26.668 11.072 27.948C11.272 32.306 13.69 34.728 18.052 34.928C19.333 34.986 19.741 35 23 35C26.259 35 26.668 34.986 27.948 34.928C32.302 34.728 34.73 32.31 34.927 27.948C34.986 26.668 35 26.259 35 23C35 19.741 34.986 19.333 34.928 18.053C34.732 13.699 32.311 11.273 27.949 11.073C26.668 11.014 26.259 11 23 11ZM23 16.838C19.597 16.838 16.838 19.597 16.838 23C16.838 26.403 19.597 29.163 23 29.163C26.403 29.163 29.162 26.404 29.162 23C29.162 19.597 26.403 16.838 23 16.838ZM23 27C20.791 27 19 25.21 19 23C19 20.791 20.791 19 23 19C25.209 19 27 20.791 27 23C27 25.21 25.209 27 23 27ZM29.406 15.155C28.61 15.155 27.965 15.8 27.965 16.595C27.965 17.39 28.61 18.035 29.406 18.035C30.201 18.035 30.845 17.39 30.845 16.595C30.845 15.8 30.201 15.155 29.406 15.155Z"
                        fill="white"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_footer_instagram">
                        <rect
                          width="24"
                          height="24"
                          fill="white"
                          transform="translate(11 11)"
                        />
                      </clipPath>
                    </defs>
                  </svg>
                </a>
              </div>
            </div>

            {/* CLIA Certification - Below social icons on desktop */}
            <div className="flex flex-col items-end mt-4">
              <Image
                src="/images/clia-logo.png"
                alt="CLIA Certified"
                width={50}
                height={50}
                style={{ height: "auto" }}
              />
              <p
                className="font-geograph mt-2"
                style={{
                  fontSize: "10px",
                  color: "#2f2f2f",
                  letterSpacing: "-0.02em",
                  textAlign: "right",
                }}
              >
                CLIA Certification <strong>#03085654</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
