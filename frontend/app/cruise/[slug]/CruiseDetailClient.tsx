"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCruiseBySlug,
  getComprehensiveCruiseData,
  getCruiseDetailsById,
  ComprehensiveCruiseData,
  Cruise,
  normalizeCruiseData,
} from "../../../lib/api";
import { parseCruiseSlug } from "../../../lib/slug";
import { useAlert } from "../../../components/GlobalAlertProvider";
import QuoteModalNative from "../../components/QuoteModalNative";
import {
  trackCruiseView,
  trackTimeOnPage,
  trackQuoteStart,
} from "../../../lib/analytics";
import { useAdmin } from "../../hooks/useAdmin";
import { useBooking } from "../../context/BookingContext";
import SpecificCabinModal from "../../components/SpecificCabinModal";
import PassengerSelector from "../../components/PassengerSelector";
import dynamic from "next/dynamic";

const PriceHistoryChart = dynamic(
  () => import("../../components/PriceHistoryChart"),
  {
    ssr: false,
  },
);

interface CruiseDetailPageProps {}

export default function CruiseDetailPage({}: CruiseDetailPageProps) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { showAlert } = useAlert();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { sessionId, passengerCount, createSession } = useBooking();

  const [cruiseData, setCruiseData] = useState<ComprehensiveCruiseData | null>(
    null,
  );
  const [fallbackData, setFallbackData] = useState<Cruise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedCabinType, setSelectedCabinType] = useState<string>("");
  const [selectedCabinPrice, setSelectedCabinPrice] = useState<string | number>(
    0,
  );
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Live booking state
  const [isLiveBookable, setIsLiveBookable] = useState(false);
  const [liveCabinGrades, setLiveCabinGrades] = useState<any>(null);
  const [isLoadingCabins, setIsLoadingCabins] = useState(false);
  const [selectedCabinCategory, setSelectedCabinCategory] =
    useState<string>("interior"); // Tab state
  const [selectedRateCode, setSelectedRateCode] = useState<string | null>(null); // Rate code selector
  const [showAllCabins, setShowAllCabins] = useState<Record<string, boolean>>({
    interior: false,
    oceanview: false,
    balcony: false,
    suite: false,
  }); // Load more state per category

  // Specific cabin modal state
  const [isSpecificCabinModalOpen, setIsSpecificCabinModalOpen] =
    useState(false);
  const [selectedCabinGrade, setSelectedCabinGrade] = useState<{
    resultNo: string;
    gradeNo: string;
    rateCode: string;
    gradeName: string;
  } | null>(null);

  // Time tracking
  const pageLoadTime = useRef<number>(Date.now());
  const hasTrackedView = useRef(false);

  const toggleAccordion = (index: number) => {
    setOpenAccordion(openAccordion === index ? null : index);
  };

  const handleGetQuote = (cabinType: string, price: string | number) => {
    setSelectedCabinType(cabinType);
    setSelectedCabinPrice(price);
    setQuoteModalOpen(true);

    // Track quote start event
    if (cruiseData?.cruise?.id) {
      trackQuoteStart(String(cruiseData.cruise.id), cabinType);
    }
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageModalOpen(true);
  };

  // Helper function to format price with commas
  const formatPrice = (price: number | null | undefined): string => {
    if (!price || isNaN(price)) return "0";
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Helper function to get cabin pricing for selected rate code
  const getCabinPricingForRate = (cabin: any) => {
    if (!selectedRateCode || !cabin.ratesByCode) {
      // No rate selected or no rates available - use default cheapest price
      return {
        price: cabin.cheapestPrice,
        gradeNo: cabin.gradeNo,
        rateCode: cabin.rateCode,
        resultNo: cabin.resultNo,
      };
    }

    // Use selected rate code if available for this cabin
    const rateData = cabin.ratesByCode[selectedRateCode];
    if (rateData) {
      return {
        price: rateData.price,
        gradeNo: rateData.gradeno,
        rateCode: rateData.ratecode,
        resultNo: rateData.resultno || cabin.resultNo,
      };
    }

    // Fallback to cheapest if selected rate not available for this cabin
    return {
      price: cabin.cheapestPrice,
      gradeNo: cabin.gradeNo,
      rateCode: cabin.rateCode,
      resultNo: cabin.resultNo,
    };
  };

  // Create booking session and fetch live cabin grades
  const createBookingSessionAndFetchCabins = async () => {
    if (!isLiveBookable || !passengerCount || !cruiseData?.cruise?.id) return;

    setIsLoadingCabins(true);
    try {
      // Create booking session using BookingContext
      const newSessionId = await createSession(cruiseData.cruise.id.toString());

      // Fetch live cabin grades/pricing
      const pricingResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/booking/${newSessionId}/pricing?cruiseId=${cruiseData.cruise.id}`,
      );

      if (!pricingResponse.ok) {
        throw new Error("Failed to fetch cabin pricing");
      }

      const pricingData = await pricingResponse.json();
      setLiveCabinGrades(pricingData);
    } catch (err) {
      console.error("Failed to create booking session or fetch cabins:", err);
      showAlert("Unable to load live pricing. Please try again.");
    } finally {
      setIsLoadingCabins(false);
    }
  };

  useEffect(() => {
    const loadCruiseData = async () => {
      if (!slug) return;

      try {
        setIsLoading(true);
        setError(null);
        // Parse the slug to get cruise ID
        const parsedSlug = parseCruiseSlug(slug);

        if (parsedSlug?.cruiseId) {
          // Try comprehensive endpoint first (most reliable)
          try {
            const comprehensiveData = await getComprehensiveCruiseData(
              parsedSlug.cruiseId,
            );
            if (comprehensiveData) {
              setCruiseData(comprehensiveData);
              setIsUsingFallback(false);

              // Track cruise view
              if (!hasTrackedView.current && comprehensiveData.cruise) {
                const price =
                  comprehensiveData.cheapestPricing?.cheapestPrice ||
                  comprehensiveData.cruise?.cheapestprice ||
                  comprehensiveData.cruise?.cheapest?.combined?.inside ||
                  comprehensiveData.cruise?.cheapestinside;

                trackCruiseView({
                  cruiseId: String(comprehensiveData.cruise.id),
                  cruiseName: comprehensiveData.cruise.name || "",
                  cruiseLine: comprehensiveData.cruiseLine?.name || "",
                  nights: comprehensiveData.cruise.nights || 0,
                  departureDate: comprehensiveData.cruise.sailingDate || "",
                  price: price ? parseFloat(String(price)) : undefined,
                  destination: comprehensiveData.regions?.[0]?.name,
                });
                hasTrackedView.current = true;
              }

              return;
            }
          } catch (err) {
            console.log(
              "Comprehensive endpoint failed, trying alternatives:",
              err,
            );
          }

          // Try slug endpoint as backup (in case it works for some cruises)
          try {
            const data = await getCruiseBySlug(slug);
            if (data) {
              setCruiseData(data);
              setIsUsingFallback(false);
              return;
            }
          } catch (err) {
            console.log("Slug endpoint failed:", err);
          }

          // Final fallback - try to get basic cruise data
          try {
            const basicData = await getCruiseDetailsById(parsedSlug.cruiseId);
            if (basicData) {
              setFallbackData(basicData);
              setIsUsingFallback(true);
              return;
            }
          } catch (err) {
            console.log("All fallback methods failed:", err);
          }
        }

        // If all methods fail
        showAlert("Cruise not found");
        setError("Cruise not found");
      } catch (err) {
        console.error("Failed to load cruise data:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load cruise data";
        showAlert(errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadCruiseData();
  }, [slug]);

  // Track time on page
  useEffect(() => {
    return () => {
      const timeOnPageSeconds = Math.round(
        (Date.now() - pageLoadTime.current) / 1000,
      );
      if (timeOnPageSeconds > 0 && cruiseData?.cruise?.name) {
        trackTimeOnPage("cruise_detail", timeOnPageSeconds);
      }
    };
  }, [cruiseData]);

  // Check if cruise is live-bookable
  useEffect(() => {
    if (!cruiseData?.cruise) return;

    // Check if live booking is enabled via environment variable
    const liveBookingEnabled =
      process.env.NEXT_PUBLIC_ENABLE_LIVE_BOOKING === "true";

    // Royal Caribbean (22) and Celebrity (3) are live-bookable
    const liveBookingLineIds = [22, 3];
    const cruiseLineId = cruiseData.cruiseLine?.id;
    const isLiveBooking =
      liveBookingEnabled && cruiseLineId
        ? liveBookingLineIds.includes(Number(cruiseLineId))
        : false;
    setIsLiveBookable(isLiveBooking);
  }, [cruiseData]);

  // Auto-fetch cabin grades when cruise is live-bookable and passenger data is available
  useEffect(() => {
    if (
      isLiveBookable &&
      passengerCount &&
      cruiseData?.cruise?.id &&
      !isLoadingCabins &&
      !liveCabinGrades // Only fetch if we don't have cabin data yet
    ) {
      createBookingSessionAndFetchCabins();
    }
  }, [isLiveBookable, passengerCount, cruiseData?.cruise?.id, isLoadingCabins]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    try {
      // Parse the UTC date and format it properly
      const date = new Date(dateString);
      const formatted = date
        .toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC", // Use UTC to avoid timezone conversion issues
        })
        .toUpperCase();
      // Remove the second comma (between day and year) and convert SEP to SEPT
      return formatted.replace(/,\s*(\d{4})$/, " $1").replace(/SEP /g, "SEPT ");
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateString;
    }
  };

  // Helper function to check if an itinerary day should be non-interactive
  const isDayWithoutContent = (day: any) => {
    if (!day) return true;

    // For "At Sea" days, only show as interactive if there's a description
    const isAtSea =
      day.portName &&
      (day.portName.toLowerCase() === "at sea" ||
        day.portName.toLowerCase() === "day at sea" ||
        day.portName.toLowerCase() === "sea day");

    if (isAtSea) {
      // At Sea days should only be expandable if they have a description
      return !(day.description && day.description.trim().length > 0);
    }

    // For port days, check if there's meaningful content to show
    const hasContent =
      (day.description && day.description.trim().length > 0) || day.overnight;

    return !hasContent;
  };

  const calculateReturnDate = (
    sailingDate: string | undefined,
    nights: number | undefined,
  ) => {
    if (!sailingDate || !nights) return null;
    try {
      const departure = new Date(sailingDate);
      const returnDate = new Date(departure);
      returnDate.setUTCDate(departure.getUTCDate() + nights);
      return returnDate.toISOString();
    } catch {
      return null;
    }
  };

  // Helper function to check if price is available
  const isPriceAvailable = (price: string | number | undefined) => {
    if (!price) return false;
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return !isNaN(numPrice) && numPrice > 0;
  };

  // Helper function to check if this is a suite-only cruise line
  const isSuiteOnlyCruiseLine = () => {
    const cruiseLineName = cruiseLine?.name || "";
    const suiteOnlyLines = [
      "Explora Journeys",
      "Silversea",
      "Regent Seven Seas Cruises",
    ];
    return suiteOnlyLines.includes(cruiseLineName);
  };

  // Helper function to calculate onboard credit based on price
  const calculateOnboardCredit = (price: string | number | undefined) => {
    if (!isPriceAvailable(price)) return 0;
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    if (!numPrice || isNaN(numPrice)) return 0;
    // Calculate 8% of the price as onboard credit, rounded down to nearest $10
    const creditPercent = 0.08; // 8%
    const rawCredit = numPrice * creditPercent;
    return Math.floor(rawCredit / 10) * 10; // Round down to nearest $10
  };

  // Helper function to get cabin details using price codes
  const getCabinDetailsFromPriceCode = (
    cabinType: "interior" | "oceanview" | "balcony" | "suite",
  ) => {
    // Get the raw data from cheapestPricing (where it's actually stored)
    const rawData = cruiseData?.cheapestPricing?.raw || fallbackData?.rawData;
    const cheapestPricingData: any = cruiseData?.cheapestPricing || {};

    if (!rawData)
      return {
        price: null,
        image: null,
        description: null,
        name: null,
        cabinCode: null,
      };

    // Map cabin type to the correct field names
    const fieldMap = {
      interior: {
        priceField: "cheapestinside",
        priceCodeField: "cheapestinsidepricecode",
        priceKey: "interiorPrice",
        priceCodeKey: "interiorPriceCode",
      },
      oceanview: {
        priceField: "cheapestoutside",
        priceCodeField: "cheapestoutsidepricecode",
        priceKey: "oceanviewPrice",
        priceCodeKey: "oceanviewPriceCode",
      },
      balcony: {
        priceField: "cheapestbalcony",
        priceCodeField: "cheapestbalconypricecode",
        priceKey: "balconyPrice",
        priceCodeKey: "balconyPriceCode",
      },
      suite: {
        priceField: "cheapestsuite",
        priceCodeField: "cheapestsuitepricecode",
        priceKey: "suitePrice",
        priceCodeKey: "suitePriceCode",
      },
    };

    const fields = fieldMap[cabinType];

    // Get the price from cheapestPricing or rawData
    const price =
      cheapestPricingData[fields.priceKey] ||
      (rawData as any)[fields.priceField]?.price ||
      (rawData as any)[fields.priceField];

    // Get the price code from cheapestPricing or rawData
    const priceCode =
      cheapestPricingData[fields.priceCodeKey] ||
      (rawData as any)[fields.priceCodeField];

    // If no prices or cabins data, bail early
    if (!(rawData as any).prices || !(rawData as any).cabins) {
      return {
        price,
        image: null,
        description: null,
        name: null,
        cabinCode: null,
      };
    }

    // Parse the price code - handle both pipe-delimited and rate-code-only formats
    let rateCode: string;
    let cabinCode: string | undefined;

    // Map frontend cabin type to Traveltek's cabin type naming
    const cabinTypeMap: Record<string, string> = {
      interior: "inside",
      oceanview: "outside",
      balcony: "balcony",
      suite: "suite",
    };

    const targetCabinType = cabinTypeMap[cabinType];

    if (priceCode) {
      // We have a price code - use it
      if (priceCode.includes("|")) {
        // Format: "RATECODE|CABINCODE|OCCUPANCY" (future-proof)
        [rateCode, cabinCode] = priceCode.split("|");
      } else {
        // Format: "RATECODE" only (current reality from Traveltek)
        rateCode = priceCode;

        // Find cheapest cabin of the correct type in this rate code
        const cabinsInRate = (rawData as any).prices?.[rateCode];
        if (cabinsInRate && typeof cabinsInRate === "object") {
          const matchingCabins = Object.entries(cabinsInRate)
            .filter(
              ([_, priceData]: any) => priceData?.cabintype === targetCabinType,
            )
            .map(([cabinId, priceData]: any) => ({
              cabinId,
              price: parseFloat(priceData.price || "0"),
            }))
            .sort((a, b) => a.price - b.price);

          // Use the cheapest cabin
          cabinCode = matchingCabins[0]?.cabinId;
        }
      }
    } else {
      // No price code - derive it from prices object
      // Search all rate codes (usually just "" empty string) for cheapest cabin of this type
      const allPrices = (rawData as any).prices;
      const allMatchingCabins: Array<{ cabinId: string; price: number }> = [];

      for (const rateCodeKey of Object.keys(allPrices)) {
        const cabinsInRate = allPrices[rateCodeKey];
        if (cabinsInRate && typeof cabinsInRate === "object") {
          const matchingCabins = Object.entries(cabinsInRate)
            .filter(
              ([_, priceData]: any) => priceData?.cabintype === targetCabinType,
            )
            .map(([cabinId, priceData]: any) => ({
              cabinId,
              price: parseFloat(priceData.price || "0"),
            }));

          allMatchingCabins.push(...matchingCabins);
        }
      }

      // Sort by price and use the cheapest
      if (allMatchingCabins.length > 0) {
        allMatchingCabins.sort((a, b) => a.price - b.price);
        cabinCode = allMatchingCabins[0].cabinId;
      }
    }

    if (!cabinCode) {
      return {
        price,
        image: null,
        description: null,
        name: null,
        cabinCode: null,
      };
    }

    // Look up the cabin details in the cabins object
    const cabinDetails = (rawData as any).cabins?.[cabinCode];

    if (!cabinDetails) {
      return { price, image: null, description: null, name: null, cabinCode };
    }

    return {
      price,
      image: cabinDetails.imageurlhd || cabinDetails.imageurl || null,
      description: cabinDetails.description || null,
      name: cabinDetails.name || null,
      cabinCode,
    };
  };

  // Legacy helper function for fallback
  const getCabinData = (cabinType: string) => {
    if (!cruiseData?.cabinCategories) return { image: null, description: null };

    const normalizedType = cabinType.toLowerCase();
    let targetCategory = "";

    // Map cabin types to categories - use same naming as pricing fields
    if (
      normalizedType.includes("interior") ||
      normalizedType.includes("inside")
    ) {
      targetCategory = "inside";
    } else if (
      normalizedType.includes("oceanview") ||
      normalizedType.includes("outside")
    ) {
      targetCategory = "outside";
    } else if (normalizedType.includes("balcony")) {
      targetCategory = "balcony";
    } else if (normalizedType.includes("suite")) {
      targetCategory = "suite";
    }

    // Try to use the pricing source field to find the exact cabin
    const sourceField = pricing?.raw?.combined?.[`${targetCategory}source`];
    const priceCode = pricing?.raw?.combined?.[`${targetCategory}pricecode`];

    let cabinCategory = null;

    // First, try to match using the exact cabin code from pricing
    if (priceCode || sourceField) {
      cabinCategory = cruiseData.cabinCategories.find((cabin) => {
        const cabinCode = cabin.cabinCode?.toLowerCase() || "";
        const cabinCodeAlt = cabin.cabinCodeAlt?.toLowerCase() || "";
        const searchCode = (priceCode || sourceField || "").toLowerCase();

        // Try exact match on cabin codes
        return cabinCode === searchCode || cabinCodeAlt === searchCode;
      });
    }

    // If no exact match found using pricing codes, fall back to category matching
    // but be more specific about the category type
    if (!cabinCategory) {
      cabinCategory = cruiseData.cabinCategories.find((cabin) => {
        const cabinCat = cabin.category?.toLowerCase() || "";
        const cabinName = cabin.name?.toLowerCase() || "";

        // More specific matching based on category
        if (targetCategory === "inside") {
          // For inside cabins, match "inside", "interior", or generic "cabin" (used by Viking, etc.)
          // Avoid matching balcony or suite cabins
          return (
            (cabinCat === "inside" ||
              cabinCat === "interior" ||
              cabinCat === "cabin") &&
            !cabinName.includes("balcony") &&
            !cabinName.includes("suite") &&
            !cabinName.includes("oceanview") &&
            !cabinName.includes("outside") &&
            !cabinName.includes("veranda") &&
            !cabinName.includes("french balcony")
          );
        } else if (targetCategory === "outside") {
          // For outside cabins, avoid matching balcony or suite cabins
          return (
            (cabinCat === "outside" || cabinCat === "oceanview") &&
            !cabinName.includes("balcony") &&
            !cabinName.includes("suite") &&
            !cabinName.includes("interior") &&
            !cabinName.includes("inside") &&
            !cabinName.includes("veranda") &&
            !cabinName.includes("french balcony")
          );
        } else if (targetCategory === "balcony") {
          // For balcony cabins, avoid matching suite cabins
          return (
            cabinCat === "balcony" &&
            !cabinName.includes("suite") &&
            !cabinName.includes("penthouse")
          );
        } else if (targetCategory === "suite") {
          // For suites, match actual suites
          return (
            cabinCat === "suite" ||
            cabinName.includes("suite") ||
            cabinName.includes("penthouse")
          );
        }
        return false;
      });
    }

    // Final fallback: if still no match, try a looser match but prioritize lower categories
    if (!cabinCategory && targetCategory !== "suite") {
      const allCabins = cruiseData.cabinCategories
        .filter((cabin) => {
          const cabinCat = cabin.category?.toLowerCase() || "";
          const cabinName = cabin.name?.toLowerCase() || "";

          if (targetCategory === "inside") {
            return (
              cabinCat.includes("inside") ||
              cabinCat.includes("interior") ||
              cabinCat === "cabin" ||
              cabinName.includes("inside") ||
              cabinName.includes("interior") ||
              (cabinName.includes("standard") &&
                !cabinName.includes("balcony") &&
                !cabinName.includes("veranda"))
            );
          } else if (targetCategory === "outside") {
            return (
              cabinCat.includes("outside") ||
              cabinCat.includes("oceanview") ||
              cabinName.includes("outside") ||
              cabinName.includes("oceanview")
            );
          } else if (targetCategory === "balcony") {
            return (
              cabinCat.includes("balcony") || cabinName.includes("balcony")
            );
          }
          return false;
        })
        .sort((a, b) => {
          // Sort to prefer simpler cabin names (likely to be standard cabins)
          const aLen = (a.name || "").length;
          const bLen = (b.name || "").length;
          return aLen - bLen;
        });

      cabinCategory = allCabins[0] || null;
    }

    return {
      image: cabinCategory
        ? cabinCategory.imageUrl || cabinCategory.imageUrlHd // Prefer regular URL as HD often broken
        : null,
      description: cabinCategory?.description || null,
    };
  };

  // Updated helper functions to use the new price code lookup
  const getCabinImage = (cabinType: string) => {
    // First try to get from price code lookup
    const cabinDetails = getCabinDetailsFromPriceCode(
      cabinType as "interior" | "oceanview" | "balcony" | "suite",
    );
    if (cabinDetails.image) return cabinDetails.image;

    // Fall back to legacy method
    return getCabinData(cabinType).image;
  };

  const getCabinDescription = (cabinType: string) => {
    // First try to get from price code lookup
    const cabinDetails = getCabinDetailsFromPriceCode(
      cabinType as "interior" | "oceanview" | "balcony" | "suite",
    );
    if (cabinDetails.description) {
      // Truncate to 120 characters and add ellipsis if needed
      return cabinDetails.description.length > 120
        ? cabinDetails.description.substring(0, 120) + "..."
        : cabinDetails.description;
    }

    // Fall back to legacy method
    const description = getCabinData(cabinType).description;
    if (!description) return null;
    return description.length > 120
      ? description.substring(0, 120) + "..."
      : description;
  };

  const getCabinName = (cabinType: string) => {
    const cabinDetails = getCabinDetailsFromPriceCode(
      cabinType as "interior" | "oceanview" | "balcony" | "suite",
    );
    return cabinDetails.name;
  };

  const getCabinPrice = (
    cabinType: "interior" | "oceanview" | "balcony" | "suite",
  ) => {
    // Get price from the new individual fields (NOT combined)
    const rawData: any = pricing?.raw || {};
    const cheapestPricingData: any = pricing || {};

    const priceMapping = {
      interior:
        rawData.cheapestinside ||
        cheapestPricingData.interiorPrice ||
        cruise?.interiorPrice,
      oceanview:
        rawData.cheapestoutside ||
        cheapestPricingData.oceanviewPrice ||
        cruise?.oceanviewPrice,
      balcony:
        rawData.cheapestbalcony ||
        cheapestPricingData.balconyPrice ||
        cruise?.balconyPrice,
      suite:
        rawData.cheapestsuite ||
        cheapestPricingData.suitePrice ||
        cruise?.suitePrice,
    };

    return priceMapping[cabinType];
  };

  if (isLoading) {
    return (
      <div
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "1.5rem",
            color: "#4a5568",
            marginTop: "4rem",
          }}
        >
          Loading cruise details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "2rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#fed7d7",
            color: "#9b2c2c",
            padding: "2rem",
            borderRadius: "8px",
            textAlign: "center",
            marginTop: "2rem",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Cruise Not Found
          </h2>
          <p style={{ marginBottom: "1.5rem" }}>
            We couldn't find the cruise you're looking for. The cruise may no
            longer be available or the link may be incorrect.
          </p>
          <button
            onClick={() => router.push("/")}
            style={{
              backgroundColor: "#4299e1",
              color: "white",
              padding: "0.75rem 1.5rem",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "600",
            }}
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  // Use comprehensive data if available, otherwise use fallback with normalization
  const cruise =
    cruiseData?.cruise ||
    (fallbackData ? normalizeCruiseData(fallbackData) : null);
  const fallbackShip = fallbackData?.ship as any;
  const ship = cruiseData?.ship || {
    name: fallbackData?.shipName || fallbackShip?.name || "",
    defaultShipImage: fallbackShip?.defaultShipImage || null,
    defaultShipImage2k: fallbackShip?.defaultShipImage2k || null,
    defaultShipImageHd: fallbackShip?.defaultShipImageHd || null,
    description: fallbackShip?.description || null,
    shortDescription:
      fallbackShip?.description || fallbackShip?.shortDescription || null,
    tonnage: fallbackShip?.tonnage || null,
    starRating: fallbackShip?.starRating || null,
    capacity: fallbackShip?.capacity || null,
    yearBuilt: fallbackShip?.yearBuilt || fallbackShip?.launchedYear || null,
    length: fallbackShip?.length || null,
    raw: fallbackShip || null,
  };
  const fallbackCruiseLine = fallbackData?.cruiseLine as any;
  const cruiseLine = cruiseData?.cruiseLine || {
    name: fallbackData?.cruiseLineName || fallbackCruiseLine?.name || "",
    raw: fallbackCruiseLine || null,
  };
  const fallbackEmbarkPort = fallbackData?.embarkPort as any;
  const embarkPort = cruiseData?.embarkPort || {
    name: fallbackData?.departurePort || fallbackEmbarkPort?.name || "",
  };
  const fallbackDisembarkPort = fallbackData?.disembarkPort as any;
  const disembarkPort = cruiseData?.disembarkPort || {
    name: fallbackData?.arrivalPort || fallbackDisembarkPort?.name || "",
  };
  const pricing = cruiseData?.cheapestPricing;

  if (!cruise) {
    return (
      <div
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ color: "#e53e3e", fontSize: "1.5rem" }}>
          No cruise data available
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Warning for fallback data */}
      {isUsingFallback && (
        <div className="bg-sand py-6">
          <div className="max-w-7xl mx-auto px-6">
            <div
              style={{
                backgroundColor: "#fef5e7",
                color: "#975a16",
                padding: "1rem",
                borderRadius: "6px",
                marginBottom: "2rem",
                border: "1px solid #f6e05e",
              }}
            >
              <strong>Limited Data:</strong> We're showing basic information for
              this cruise. Some detailed information may not be available.
            </div>
          </div>
        </div>
      )}

      {/* Hero Section with New Branded Design */}
      <div className="bg-purple-obc py-12 px-6 -mt-[60px] md:-mt-[80px] pt-[180px] md:pt-[200px] md:pb-[100px]">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 items-center">
            {/* Left Side Content */}
            <div>
              {/* Cruise Name */}
              <h1
                className="font-whitney text-[42px] md:text-[52px] text-dark-blue mb-4 uppercase"
                style={{ letterSpacing: "-0.02em", lineHeight: "1.1" }}
              >
                {cruise.name || `${ship?.name || "Unknown Ship"} Cruise`}
              </h1>

              {/* Cruise Line | Ship Name */}
              <div
                className="text-dark-blue text-[18px] font-geograph font-medium mb-12"
                style={{ letterSpacing: "-0.02em" }}
              >
                {cruiseLine?.name || "Unknown Cruise Line"} |{" "}
                {ship?.name || "Unknown Ship"}
              </div>

              {/* Information Grid - 2x2 Layout */}
              <div className="grid grid-cols-2 gap-3">
                {/* Depart */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    DEPART
                  </div>
                  <div
                    className="text-[24px] font-whitney text-dark-blue uppercase md:leading-normal leading-[1]"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {formatDate(cruise?.sailingDate || cruise?.departureDate)}
                  </div>
                </div>

                {/* Return */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    RETURN
                  </div>
                  <div
                    className="text-[24px] font-whitney text-dark-blue uppercase md:leading-normal leading-[1]"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {(() => {
                      const returnDateFromDb = cruise?.returnDate;
                      const sailingDate =
                        cruise?.sailingDate || cruise?.departureDate;
                      const nights = cruise?.nights || cruise?.duration;
                      const calculatedReturnDate = calculateReturnDate(
                        sailingDate,
                        nights,
                      );
                      const displayDate =
                        returnDateFromDb || calculatedReturnDate;
                      return formatDate(displayDate);
                    })()}
                  </div>
                </div>

                {/* Departure Port */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    DEPARTURE PORT
                  </div>
                  <div
                    className="text-[24px] font-whitney text-dark-blue uppercase md:leading-normal leading-[1]"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {embarkPort?.name || "N/A"}
                  </div>
                </div>

                {/* Nights */}
                <div>
                  <div className="text-[11px] font-bold font-geograph tracking-[0.1em] text-[#2f2f2f] uppercase mb-1">
                    NIGHTS
                  </div>
                  <div
                    className="text-[24px] font-whitney text-dark-blue uppercase md:leading-normal leading-[1]"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {cruise?.nights || cruise?.duration} NIGHTS
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Ship Image */}
            <div className="flex justify-center">
              {ship?.defaultShipImage ? (
                <img
                  src={
                    ship.defaultShipImage ||
                    ship.defaultShipImageHd ||
                    ship.defaultShipImage2k
                  }
                  alt={`${ship.name} - Ship`}
                  className="w-full rounded-[10px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ height: "400px", aspectRatio: "3/2" }}
                  onClick={() => {
                    const imageUrl =
                      ship.defaultShipImage ||
                      ship.defaultShipImageHd ||
                      ship.defaultShipImage2k;
                    if (imageUrl) handleImageClick(imageUrl);
                  }}
                />
              ) : (
                <div
                  className="w-full bg-gray-200 rounded-[10px] flex items-center justify-center text-gray-500"
                  style={{ height: "400px", aspectRatio: "3/2" }}
                >
                  No Ship Image Available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section Separator */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-4.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Body Section - Updated background and styling */}
      <div className="bg-sand py-8 md:py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          {/* Lowest Price Guarantee Box */}
          <div className="mb-6 bg-white rounded-[5px] border border-[#d9d9d9] p-4 md:py-[22px] md:px-[15px]">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="flex-shrink-0">
                <img
                  src="/images/best-price.svg"
                  alt="Best Price"
                  width={55}
                  height={55}
                  className="w-[55px] h-[55px]"
                />
              </div>

              {/* Text Content */}
              <div>
                <h3
                  className="font-whitney font-black text-[20px] text-[#1c1c1c] uppercase mb-1"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Lowest Price Guarantee
                </h3>
                <p
                  className="font-geograph text-[16px] text-[#2f2f2f] leading-[1.5]"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Fare prices shown come directly from cruise lines, never any
                  added fees or markups
                </p>
              </div>
            </div>
          </div>

          {/* Description Section */}
          {(ship?.description || ship?.shortDescription) && (
            <div className="mb-6">
              <p
                className="font-geograph text-[18px] md:text-[24px] leading-[1.5] text-dark-blue"
                style={{ letterSpacing: "-0.02em" }}
              >
                {(() => {
                  const desc = ship.description || ship.shortDescription || "";
                  return desc.length > 600 && !isDescriptionExpanded ? (
                    <>
                      {desc.substring(0, 600)}...{" "}
                      <button
                        onClick={() => setIsDescriptionExpanded(true)}
                        className="text-pink-500 hover:text-pink-600 underline font-medium transition-colors"
                        style={{ letterSpacing: "-0.02em" }}
                      >
                        Read more
                      </button>
                    </>
                  ) : (
                    <>
                      {desc}
                      {desc.length > 600 && (
                        <>
                          {" "}
                          <button
                            onClick={() => setIsDescriptionExpanded(false)}
                            className="text-pink-500 hover:text-pink-600 underline font-medium transition-colors"
                            style={{ letterSpacing: "-0.02em" }}
                          >
                            Read less
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </p>
            </div>
          )}

          {/* Additional cruise details can be added here */}

          {/* Admin-Only Price History Chart */}
          {!adminLoading && isAdmin && cruise?.id && (
            <div className="mt-8">
              <PriceHistoryChart cruiseId={cruise.id.toString()} />
            </div>
          )}
        </div>
      </div>

      {/* Choose Your Room Section */}
      {(pricing ||
        cruise?.interiorPrice ||
        cruise?.oceanviewPrice ||
        cruise?.balconyPrice ||
        cruise?.suitePrice ||
        isLiveBookable) && (
        <div className="bg-sand pb-0">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="mb-6 px-0 md:px-0">
              <h2
                className="font-whitney font-black text-[32px] text-dark-blue uppercase"
                style={{ letterSpacing: "-0.02em" }}
              >
                CHOOSE YOUR ROOM
              </h2>
              {isLiveBookable && liveCabinGrades ? (
                <div className="flex items-center gap-4">
                  <span
                    className="font-geograph text-[18px] text-[#2f2f2f]"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    Passengers:
                  </span>
                  <PassengerSelector
                    value={{
                      adults: passengerCount?.adults || 2,
                      children: passengerCount?.children || 0,
                      childAges: passengerCount?.childAges || [],
                    }}
                    onChange={(newPassengerCount) => {
                      // Update passenger count in context and refetch pricing
                      sessionStorage.setItem(
                        "passengerCount",
                        JSON.stringify(newPassengerCount),
                      );
                      createBookingSessionAndFetchCabins();
                    }}
                    className="w-64"
                  />
                </div>
              ) : (
                <p
                  className="font-geograph text-[18px] text-[#2f2f2f] leading-[1.5]"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Prices shown are per person based on double occupancy and
                  subject to availability
                </p>
              )}
            </div>

            {/* Loading State for Live Bookable Cruises - Skeleton Shimmer */}
            {isLiveBookable && isLoadingCabins && (
              <div>
                {/* Skeleton Category Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-10 w-24 bg-gray-200 rounded-[5px] animate-pulse"
                    ></div>
                  ))}
                </div>

                {/* Skeleton Cabin Cards - 3 column grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="bg-white rounded-lg border border-[#d9d9d9] overflow-hidden"
                    >
                      {/* Skeleton Image */}
                      <div className="w-full h-48 bg-gray-200 animate-pulse"></div>

                      {/* Skeleton Content */}
                      <div className="p-4">
                        {/* Skeleton Title */}
                        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4 animate-pulse"></div>

                        {/* Skeleton Description Lines */}
                        <div className="space-y-2 mb-4">
                          <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                          <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
                          <div className="h-4 bg-gray-200 rounded w-4/6 animate-pulse"></div>
                        </div>

                        {/* Skeleton Separator */}
                        <div className="border-t border-[#d9d9d9] mb-4"></div>

                        {/* Skeleton Pricing Row */}
                        <div className="flex items-end justify-between gap-4">
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse"></div>
                            <div className="h-8 bg-gray-200 rounded w-28 animate-pulse"></div>
                          </div>
                          <div className="h-10 w-24 bg-gray-200 rounded-[5px] animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Cabin Categories - Show tabs for live bookable cruises */}
            {isLiveBookable && liveCabinGrades && !isLoadingCabins && (
              <div>
                {/* Rate Code Selector */}
                {liveCabinGrades.availableRateCodes &&
                  liveCabinGrades.availableRateCodes.length > 0 && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <label
                        htmlFor="rate-code-selector"
                        className="block text-sm font-geograph font-medium text-gray-700 mb-2"
                      >
                        Select Rate Code (for testing)
                      </label>
                      <select
                        id="rate-code-selector"
                        value={selectedRateCode || ""}
                        onChange={(e) =>
                          setSelectedRateCode(e.target.value || null)
                        }
                        className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-md font-geograph focus:ring-2 focus:ring-dark-blue focus:border-dark-blue"
                      >
                        <option value="">Cheapest Rate (Auto)</option>
                        {liveCabinGrades.availableRateCodes.map((rate: any) => (
                          <option key={rate.code} value={rate.code}>
                            {rate.code} - {rate.name || rate.description}
                            {rate.isRefundable ? " ⭐ REFUNDABLE" : ""}
                            {rate.military ? " 🎖️ MILITARY" : ""}
                            {rate.senior ? " 👴 SENIOR" : ""}
                            {rate.pastpassenger ? " 🚢 PAST GUEST" : ""}
                          </option>
                        ))}
                      </select>
                      {selectedRateCode && (
                        <p className="mt-2 text-sm text-gray-600">
                          ℹ️ All cabins below will show pricing for rate code:{" "}
                          <strong>{selectedRateCode}</strong>
                        </p>
                      )}
                    </div>
                  )}

                {/* Category Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {liveCabinGrades.cabins?.filter(
                    (cabin: any) => cabin.category === "inside",
                  ).length > 0 && (
                    <button
                      onClick={() => setSelectedCabinCategory("interior")}
                      className={`px-5 py-2 rounded-[5px] font-geograph font-medium text-[16px] transition-colors ${
                        selectedCabinCategory === "interior"
                          ? "bg-dark-blue text-white"
                          : "bg-white text-dark-blue border border-gray-300 hover:border-dark-blue"
                      }`}
                    >
                      Interior
                    </button>
                  )}
                  {liveCabinGrades.cabins?.filter(
                    (cabin: any) => cabin.category === "outside",
                  ).length > 0 && (
                    <button
                      onClick={() => setSelectedCabinCategory("oceanview")}
                      className={`px-5 py-2 rounded-[5px] font-geograph font-medium text-[16px] transition-colors ${
                        selectedCabinCategory === "oceanview"
                          ? "bg-dark-blue text-white"
                          : "bg-white text-dark-blue border border-gray-300 hover:border-dark-blue"
                      }`}
                    >
                      Oceanview
                    </button>
                  )}
                  {liveCabinGrades.cabins?.filter(
                    (cabin: any) => cabin.category === "balcony",
                  ).length > 0 && (
                    <button
                      onClick={() => setSelectedCabinCategory("balcony")}
                      className={`px-5 py-2 rounded-[5px] font-geograph font-medium text-[16px] transition-colors ${
                        selectedCabinCategory === "balcony"
                          ? "bg-dark-blue text-white"
                          : "bg-white text-dark-blue border border-gray-300 hover:border-dark-blue"
                      }`}
                    >
                      Balcony
                    </button>
                  )}
                  {liveCabinGrades.cabins?.filter(
                    (cabin: any) => cabin.category === "suite",
                  ).length > 0 && (
                    <button
                      onClick={() => setSelectedCabinCategory("suite")}
                      className={`px-5 py-2 rounded-[5px] font-geograph font-medium text-[16px] transition-colors ${
                        selectedCabinCategory === "suite"
                          ? "bg-dark-blue text-white"
                          : "bg-white text-dark-blue border border-gray-300 hover:border-dark-blue"
                      }`}
                    >
                      Suite
                    </button>
                  )}
                </div>

                {/* Cabin Cards for Selected Category */}
                <div>
                  {(() => {
                    // Filter cabins by category
                    const categoryMap: Record<string, string> = {
                      interior: "inside",
                      oceanview: "outside",
                      balcony: "balcony",
                      suite: "suite",
                    };

                    const filteredCabins =
                      liveCabinGrades.cabins
                        ?.filter(
                          (cabin: any) =>
                            cabin.category ===
                            categoryMap[selectedCabinCategory],
                        )
                        ?.sort((a: any, b: any) => {
                          // Sort: guaranteed first, then by lowest price
                          if (a.isGuaranteed && !b.isGuaranteed) return -1;
                          if (!a.isGuaranteed && b.isGuaranteed) return 1;

                          const priceA = getCabinPricingForRate(a).price || 0;
                          const priceB = getCabinPricingForRate(b).price || 0;
                          return priceA - priceB;
                        }) || [];

                    const visibleCabins = showAllCabins[selectedCabinCategory]
                      ? filteredCabins
                      : filteredCabins.slice(0, 6);

                    return (
                      <>
                        {/* 3-column grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {visibleCabins.map((cabin: any, index: number) => {
                            // Get pricing for selected rate code (or default)
                            const cabinPricing = getCabinPricingForRate(cabin);

                            return (
                              <div
                                key={cabin.code}
                                className="bg-white rounded-lg border border-[#d9d9d9] overflow-hidden relative"
                              >
                                {/* Best Value Banner */}
                                {cabin.isGuaranteed && (
                                  <div className="absolute top-0 left-0 right-0 bg-purple-obc text-dark-blue text-center font-geograph font-medium text-[12px] py-1 z-10">
                                    Best Value
                                  </div>
                                )}

                                {/* Full Bleed Cabin Image */}
                                <div className="w-full h-48 relative">
                                  {cabin.imageUrl ? (
                                    <img
                                      src={cabin.imageUrl}
                                      alt={cabin.name}
                                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() =>
                                        handleImageClick(cabin.imageUrl)
                                      }
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
                                      <span className="text-sm">
                                        {cabin.name}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Card Content */}
                                <div className="p-4">
                                  {/* Cabin Title and Code */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-geograph font-medium text-[18px] text-[#1c1c1c]">
                                      {cabin.name}
                                    </h3>
                                    {cabin.code && (
                                      <div className="flex items-center justify-center w-[32px] h-[27px] border border-[#d9d9d9] rounded">
                                        <span className="font-geograph text-[12px] text-[#2f2f2f]">
                                          {cabin.code}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Cabin Description - Truncate to 3 lines */}
                                  <p
                                    className="font-geograph text-[14px] text-[#777777] mb-4"
                                    style={{
                                      letterSpacing: "-0.02em",
                                      lineHeight: "1.5",
                                      display: "-webkit-box",
                                      WebkitLineClamp: 3,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {cabin.description || ""}
                                  </p>

                                  {/* Horizontal Separator */}
                                  <div className="border-t border-[#d9d9d9] mb-4"></div>

                                  {/* Pricing and Button Row */}
                                  <div className="flex items-end justify-between gap-4">
                                    {/* Pricing Block */}
                                    <div className="text-left">
                                      <div className="font-geograph font-bold text-[10px] text-[#474747] uppercase tracking-wider -mb-1">
                                        Total Price
                                      </div>
                                      <div className="font-geograph font-medium text-[24px] text-[#1c1c1c]">
                                        ${formatPrice(cabinPricing.price || 0)}
                                      </div>
                                      <div className="font-geograph text-[12px] text-[#777777]">
                                        Including taxes & fees
                                      </div>
                                    </div>

                                    {/* Reserve Button with Availability Warning */}
                                    <div className="flex flex-col items-end gap-1">
                                      {cabin.totalCabinsLeft &&
                                        cabin.totalCabinsLeft < 10 && (
                                          <div className="font-geograph text-[11px] text-[#777777]">
                                            {cabin.totalCabinsLeft} left at this
                                            price
                                          </div>
                                        )}
                                      <button
                                        onClick={async () => {
                                          if (
                                            cabin.isGuaranteed ||
                                            index === 0
                                          ) {
                                            // For guaranteed cabins, add to basket then proceed to booking
                                            if (!cruiseData?.cruise?.id) {
                                              showAlert(
                                                "Cruise data not available",
                                              );
                                              return;
                                            }

                                            try {
                                              setIsLoadingCabins(true);

                                              // Debug: Log cabin data being sent (using selected rate)
                                              console.log("Reserving cabin:", {
                                                resultNo: cabin.resultNo,
                                                gradeNo: cabinPricing.gradeNo,
                                                rateCode: cabinPricing.rateCode,
                                                selectedRateCode:
                                                  selectedRateCode,
                                                fullCabin: cabin,
                                              });

                                              // Add cabin to Traveltek basket (using selected rate pricing)
                                              const basketResponse =
                                                await fetch(
                                                  `${process.env.NEXT_PUBLIC_API_URL}/booking/${sessionId}/select-cabin`,
                                                  {
                                                    method: "POST",
                                                    headers: {
                                                      "Content-Type":
                                                        "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                      cruiseId:
                                                        cruiseData.cruise.id.toString(),
                                                      resultNo:
                                                        cabinPricing.resultNo,
                                                      gradeNo:
                                                        cabinPricing.gradeNo,
                                                      rateCode:
                                                        cabinPricing.rateCode,
                                                    }),
                                                  },
                                                );

                                              if (!basketResponse.ok) {
                                                throw new Error(
                                                  "Failed to reserve cabin",
                                                );
                                              }

                                              // Success! Proceed to options page
                                              router.push(
                                                `/booking/${sessionId}/options`,
                                              );
                                            } catch (err) {
                                              console.error(
                                                "Failed to add cabin to basket:",
                                                err,
                                              );
                                              showAlert(
                                                "Unable to reserve cabin. Please try again.",
                                              );
                                              setIsLoadingCabins(false);
                                            }
                                          } else {
                                            // For specific cabins, open modal (using selected rate)
                                            console.log(
                                              "Opening specific cabin modal with data:",
                                              {
                                                resultNo: cabinPricing.resultNo,
                                                gradeNo: cabinPricing.gradeNo,
                                                rateCode: cabinPricing.rateCode,
                                                selectedRateCode:
                                                  selectedRateCode,
                                                fullCabin: cabin,
                                              },
                                            );

                                            setSelectedCabinGrade({
                                              resultNo: cabinPricing.resultNo,
                                              gradeNo: cabinPricing.gradeNo,
                                              rateCode: cabinPricing.rateCode,
                                              gradeName:
                                                cabin.name ||
                                                cabin.gradeName ||
                                                cabin.category,
                                            });
                                            setIsSpecificCabinModalOpen(true);
                                          }
                                        }}
                                        disabled={isLoadingCabins}
                                        className="font-geograph font-medium text-[16px] px-[18px] py-[10px] rounded-[5px] bg-[#2f7ddd] text-white hover:bg-[#2f7ddd]/90 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                      >
                                        {isLoadingCabins && (
                                          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                                        )}
                                        {isLoadingCabins
                                          ? "Creating Booking..."
                                          : "Reserve"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Load More Button */}
                        {filteredCabins.length > 6 &&
                          !showAllCabins[selectedCabinCategory] && (
                            <button
                              onClick={() =>
                                setShowAllCabins((prev) => ({
                                  ...prev,
                                  [selectedCabinCategory]: true,
                                }))
                              }
                              className="w-full mt-4 py-3 bg-white border border-[#d9d9d9] rounded-[5px] font-geograph font-medium text-[16px] text-[#1c1c1c] hover:bg-gray-50 transition-colors"
                            >
                              Load More ({filteredCabins.length - 6} more)
                            </button>
                          )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Static Pricing - Show for non-live bookable cruises */}
            {!isLiveBookable && (
              <div className="space-y-4">
                {/* Interior Cabin Card */}
                {!isSuiteOnlyCruiseLine() && (
                  <div
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden mx-4 md:mx-0 px-4 md:px-4"
                    style={{ paddingTop: "16px", paddingBottom: "16px" }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center">
                      {/* Cabin Image */}
                      <div className="md:w-48 h-32 md:h-24 flex-shrink-0">
                        {(() => {
                          const interiorImage = getCabinImage("interior");
                          return interiorImage ? (
                            <img
                              src={interiorImage}
                              alt="Interior Cabin"
                              className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => handleImageClick(interiorImage)}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                              <span className="text-sm">Interior Cabin</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Title and Description */}
                      <div className="px-0 md:px-5 py-4 md:py-3 flex-1 min-w-0 md:min-w-[400px] max-w-full md:max-w-[480px]">
                        <h3 className="font-geograph font-medium text-[18px] text-dark-blue mb-1">
                          {getCabinName("interior") || "Inside Cabin"}
                        </h3>
                        <p className="font-geograph text-[14px] text-gray-600 leading-relaxed break-words">
                          {getCabinDescription("interior") ||
                            "Comfortable interior stateroom with twin beds that can convert to queen"}
                        </p>
                      </div>

                      {/* Pricing Block and Button - Mobile optimized */}
                      <div className="flex flex-row items-end justify-between flex-1 px-0 md:px-8">
                        <div className="text-left">
                          <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                            STARTING FROM
                          </div>
                          <div className="font-geograph font-bold text-[20px] md:text-[24px] text-dark-blue">
                            {formatPrice(getCabinPrice("interior"))}
                          </div>
                          {isPriceAvailable(getCabinPrice("interior")) && (
                            <div className="font-geograph font-medium text-[11px] md:text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] inline-block mt-1">
                              +$
                              {calculateOnboardCredit(
                                getCabinPrice("interior"),
                              )}{" "}
                              onboard credit
                            </div>
                          )}
                        </div>

                        {/* Quote CTA Button - Inline on mobile */}
                        <button
                          onClick={() =>
                            handleGetQuote(
                              getCabinName("interior") || "Interior Cabin",
                              getCabinPrice("interior"),
                            )
                          }
                          disabled={
                            !isPriceAvailable(getCabinPrice("interior"))
                          }
                          className={`font-geograph font-medium text-[14px] md:text-[16px] px-4 md:px-6 py-2 md:py-3 rounded-full transition-colors self-end ${
                            isPriceAvailable(getCabinPrice("interior"))
                              ? "bg-[#2f7ddd] text-white hover:bg-[#2f7ddd]/90 cursor-pointer"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }`}
                        >
                          Get quote
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Outside Cabin Card */}
                {!isSuiteOnlyCruiseLine() && (
                  <div
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden mx-4 md:mx-0 px-4 md:px-4"
                    style={{ paddingTop: "16px", paddingBottom: "16px" }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center">
                      {/* Cabin Image */}
                      <div className="md:w-48 h-32 md:h-24 flex-shrink-0">
                        {(() => {
                          const oceanviewImage = getCabinImage("oceanview");
                          return oceanviewImage ? (
                            <img
                              src={oceanviewImage}
                              alt="Outside Cabin"
                              className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => handleImageClick(oceanviewImage)}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                              <span className="text-sm">Outside Cabin</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Title and Description */}
                      <div className="px-0 md:px-5 py-4 md:py-3 flex-1 min-w-0 md:min-w-[400px] max-w-full md:max-w-[480px]">
                        <h3 className="font-geograph font-medium text-[18px] text-dark-blue mb-1">
                          {getCabinName("oceanview") || "Outside Cabin"}
                        </h3>
                        <p className="font-geograph text-[14px] text-gray-600 leading-relaxed break-words">
                          {getCabinDescription("oceanview") ||
                            "Ocean view stateroom with window and twin beds that can convert to queen"}
                        </p>
                      </div>

                      {/* Pricing Block and Button - Mobile optimized */}
                      <div className="flex flex-row items-end justify-between flex-1 px-0 md:px-8">
                        <div className="text-left">
                          <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                            STARTING FROM
                          </div>
                          <div className="font-geograph font-bold text-[20px] md:text-[24px] text-dark-blue">
                            {formatPrice(getCabinPrice("oceanview"))}
                          </div>
                          {isPriceAvailable(getCabinPrice("oceanview")) && (
                            <div className="font-geograph font-medium text-[11px] md:text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] inline-block mt-1">
                              +$
                              {calculateOnboardCredit(
                                getCabinPrice("oceanview"),
                              )}{" "}
                              onboard credit
                            </div>
                          )}
                        </div>

                        {/* Quote CTA Button - Inline on mobile */}
                        <button
                          onClick={() =>
                            handleGetQuote(
                              getCabinName("oceanview") || "Outside Cabin",
                              getCabinPrice("oceanview"),
                            )
                          }
                          disabled={
                            !isPriceAvailable(getCabinPrice("oceanview"))
                          }
                          className={`font-geograph font-medium text-[14px] md:text-[16px] px-4 md:px-6 py-2 md:py-3 rounded-full transition-colors self-end ${
                            isPriceAvailable(getCabinPrice("oceanview"))
                              ? "bg-[#2f7ddd] text-white hover:bg-[#2f7ddd]/90 cursor-pointer"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }`}
                        >
                          Get quote
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Balcony Cabin Card */}
                {!isSuiteOnlyCruiseLine() && (
                  <div
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden mx-4 md:mx-0 px-4 md:px-4"
                    style={{ paddingTop: "16px", paddingBottom: "16px" }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center">
                      {/* Cabin Image */}
                      <div className="md:w-48 h-32 md:h-24 flex-shrink-0">
                        {(() => {
                          const balconyImage = getCabinImage("balcony");
                          return balconyImage ? (
                            <img
                              src={balconyImage}
                              alt="Balcony Cabin"
                              className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => handleImageClick(balconyImage)}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                              <span className="text-sm">Balcony Cabin</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Title and Description */}
                      <div className="px-0 md:px-5 py-4 md:py-3 flex-1 min-w-0 md:min-w-[400px] max-w-full md:max-w-[480px]">
                        <h3 className="font-geograph font-medium text-[18px] text-dark-blue mb-1">
                          {getCabinName("balcony") || "Balcony Cabin"}
                        </h3>
                        <p className="font-geograph text-[14px] text-gray-600 leading-relaxed break-words">
                          {getCabinDescription("balcony") ||
                            "Private balcony stateroom with sliding glass door and ocean views"}
                        </p>
                      </div>

                      {/* Pricing Block and Button - Mobile optimized */}
                      <div className="flex flex-row items-end justify-between flex-1 px-0 md:px-8">
                        <div className="text-left">
                          <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                            STARTING FROM
                          </div>
                          <div className="font-geograph font-bold text-[20px] md:text-[24px] text-dark-blue">
                            {formatPrice(getCabinPrice("balcony"))}
                          </div>
                          {isPriceAvailable(getCabinPrice("balcony")) && (
                            <div className="font-geograph font-medium text-[11px] md:text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] inline-block mt-1">
                              +$
                              {calculateOnboardCredit(
                                getCabinPrice("balcony"),
                              )}{" "}
                              onboard credit
                            </div>
                          )}
                        </div>

                        {/* Quote CTA Button - Inline on mobile */}
                        <button
                          onClick={() =>
                            handleGetQuote(
                              getCabinName("balcony") || "Balcony Cabin",
                              getCabinPrice("balcony"),
                            )
                          }
                          disabled={!isPriceAvailable(getCabinPrice("balcony"))}
                          className={`font-geograph font-medium text-[14px] md:text-[16px] px-4 md:px-6 py-2 md:py-3 rounded-full transition-colors self-end ${
                            isPriceAvailable(getCabinPrice("balcony"))
                              ? "bg-[#2f7ddd] text-white hover:bg-[#2f7ddd]/90 cursor-pointer"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }`}
                        >
                          Get quote
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Suite Cabin Card */}
                <div
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden mx-4 md:mx-0 px-4 md:px-4"
                  style={{ paddingTop: "16px", paddingBottom: "16px" }}
                >
                  <div className="flex flex-col md:flex-row md:items-center">
                    {/* Cabin Image */}
                    <div className="md:w-48 h-32 md:h-24 flex-shrink-0">
                      {(() => {
                        const suiteImage = getCabinImage("suite");
                        return suiteImage ? (
                          <img
                            src={suiteImage}
                            alt="Suite Cabin"
                            className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => handleImageClick(suiteImage)}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                            <span className="text-sm">Suite Cabin</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Title and Description */}
                    <div className="px-0 md:px-5 py-4 md:py-3 flex-1 min-w-0 md:min-w-[400px] max-w-full md:max-w-[480px]">
                      <h3 className="font-geograph font-medium text-[18px] text-dark-blue mb-1">
                        {getCabinName("suite") || "Suite Cabin"}
                      </h3>
                      <p className="font-geograph text-[14px] text-gray-600 leading-relaxed break-words">
                        {getCabinDescription("suite") ||
                          "Spacious suite with separate living area, private balcony, and premium amenities"}
                      </p>
                    </div>

                    {/* Pricing Block and Button - Mobile optimized */}
                    <div className="flex flex-row items-end justify-between flex-1 px-0 md:px-8">
                      <div className="text-left">
                        <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                          STARTING FROM
                        </div>
                        <div className="font-geograph font-bold text-[20px] md:text-[24px] text-dark-blue">
                          {formatPrice(getCabinPrice("suite"))}
                        </div>
                        {isPriceAvailable(getCabinPrice("suite")) && (
                          <div className="font-geograph font-medium text-[11px] md:text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] inline-block mt-1">
                            +$
                            {calculateOnboardCredit(
                              getCabinPrice("suite"),
                            )}{" "}
                            onboard credit
                          </div>
                        )}
                      </div>

                      {/* Quote CTA Button - Inline on mobile */}
                      <button
                        onClick={() =>
                          handleGetQuote(
                            getCabinName("suite") || "Suite Cabin",
                            getCabinPrice("suite"),
                          )
                        }
                        disabled={!isPriceAvailable(getCabinPrice("suite"))}
                        className={`font-geograph font-medium text-[14px] md:text-[16px] px-4 md:px-6 py-2 md:py-3 rounded-full transition-colors self-end ${
                          isPriceAvailable(getCabinPrice("suite"))
                            ? "bg-[#2f7ddd] text-white hover:bg-[#2f7ddd]/90 cursor-pointer"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        Get quote
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Itinerary Section */}
      {cruiseData?.itinerary && cruiseData.itinerary.length > 0 && (
        <div className="bg-sand py-8 md:py-16">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="mb-6">
              <h2
                className="font-whitney font-black text-[32px] text-dark-blue uppercase mb-4"
                style={{ letterSpacing: "-0.02em" }}
              >
                ITINERARY
              </h2>
            </div>

            {/* Accordion Itinerary */}
            <div className="space-y-3 md:space-y-4">
              {cruiseData.itinerary.map((day, index) => {
                const isNonInteractive = isDayWithoutContent(day);

                return (
                  <div
                    key={index}
                    className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200"
                  >
                    {isNonInteractive ? (
                      /* Non-interactive day header (no content to expand) */
                      <div className="w-full px-6 md:px-8 py-4 md:py-6 text-left">
                        <h3
                          className="font-geograph font-medium text-[16px] md:text-[20px]"
                          style={{
                            color: "#0E1B4D",
                            letterSpacing: "-0.02em",
                            lineHeight: "1.3",
                          }}
                        >
                          DAY {day.dayNumber} - {day.portName}
                        </h3>
                      </div>
                    ) : (
                      /* Interactive header with accordion functionality */
                      <>
                        <button
                          onClick={() => toggleAccordion(index)}
                          className="w-full px-6 md:px-8 py-4 md:py-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <h3
                            className="font-geograph font-medium pr-6 md:pr-8 text-[16px] md:text-[20px]"
                            style={{
                              color: "#0E1B4D",
                              letterSpacing: "-0.02em",
                              lineHeight: "1.3",
                            }}
                          >
                            DAY {day.dayNumber} - {day.portName}
                          </h3>
                          <div
                            className={`w-6 h-6 flex items-center justify-center transition-transform duration-300 ${
                              openAccordion === index ? "rotate-180" : ""
                            }`}
                          >
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="text-dark-blue"
                            >
                              <path
                                d="M6 9L12 15L18 9"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </button>

                        {/* Answer Panel */}
                        <div
                          className={`transition-all duration-300 ease-in-out overflow-hidden ${
                            openAccordion === index
                              ? "max-h-96 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="px-6 md:px-8 pb-4 md:pb-6 pt-2">
                            {day.description && (
                              <p
                                className="font-geograph text-[14px] md:text-[18px]"
                                style={{
                                  color: "#0E1B4D",
                                  letterSpacing: "-0.02em",
                                  lineHeight: "1.6",
                                }}
                              >
                                {day.description}
                              </p>
                            )}
                            {day.overnight && (
                              <div className="mt-3">
                                <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                                  OVERNIGHT STAY
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer Separator */}
      <div
        className="w-full h-[21px]"
        style={{
          backgroundImage: 'url("/images/separator-3.png")',
          backgroundRepeat: "repeat-x",
          backgroundSize: "1749px 21px",
          backgroundPosition: "left top",
        }}
      />

      {/* Quote Modal */}
      <QuoteModalNative
        isOpen={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        cruiseData={{
          id: cruise?.id?.toString(),
          name: cruise?.name || `${ship?.name || "Unknown Ship"} Cruise`,
          cruiseLineName: cruiseLine?.name || "Unknown Cruise Line",
          shipName: ship?.name || "Unknown Ship",
          sailingDate: cruise?.sailingDate,
          nights: cruise?.nights,
        }}
        cabinType={selectedCabinType}
        cabinPrice={selectedCabinPrice}
      />

      {/* Image Modal */}
      {imageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
          onClick={() => setImageModalOpen(false)}
        >
          <img
            src={selectedImage}
            alt="Enlarged View"
            className="max-w-full max-h-full object-contain rounded-[10px]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Specific Cabin Selection Modal */}
      {selectedCabinGrade && cruiseData?.cruise?.id && (
        <SpecificCabinModal
          isOpen={isSpecificCabinModalOpen}
          onClose={() => {
            setIsSpecificCabinModalOpen(false);
            setSelectedCabinGrade(null);
          }}
          onSelect={async (cabinResultNo: string) => {
            // User selected a specific cabin - add to basket
            // cabinResultNo is the specific cabin's resultNo from getCabins API
            try {
              setIsLoadingCabins(true);
              setIsSpecificCabinModalOpen(false);

              console.log("Reserving cabin:", {
                resultNo: selectedCabinGrade.resultNo,
                gradeNo: selectedCabinGrade.gradeNo,
                rateCode: selectedCabinGrade.rateCode,
                cabinResult: cabinResultNo,
              });

              const basketResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/booking/${sessionId}/select-cabin`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    cruiseId: cruiseData.cruise.id.toString(),
                    resultNo: selectedCabinGrade.resultNo,
                    gradeNo: selectedCabinGrade.gradeNo,
                    rateCode: selectedCabinGrade.rateCode,
                    cabinResult: cabinResultNo,
                  }),
                },
              );

              if (!basketResponse.ok) {
                throw new Error("Failed to reserve cabin");
              }

              // Success! Proceed to options page
              router.push(`/booking/${sessionId}/options`);
            } catch (err) {
              console.error("Failed to add cabin to basket:", err);
              showAlert("Unable to reserve cabin. Please try again.");
              setIsLoadingCabins(false);
              setIsSpecificCabinModalOpen(true); // Reopen modal on error
            }
          }}
          sessionId={sessionId || ""}
          cruiseId={cruiseData.cruise.id.toString()}
          resultNo={selectedCabinGrade.resultNo}
          gradeNo={selectedCabinGrade.gradeNo}
          rateCode={selectedCabinGrade.rateCode}
          cabinGradeName={selectedCabinGrade.gradeName}
        />
      )}
    </div>
  );
}
