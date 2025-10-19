"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface PassengerCount {
  adults: number;
  children: number;
  childAges: number[];
}

interface BookingContextType {
  sessionId: string | null;
  passengerCount: PassengerCount;
  setPassengerCount: (count: PassengerCount) => void;
  createSession: (cruiseId: string) => Promise<string>;
  clearSession: () => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [passengerCount, setPassengerCount] = useState<PassengerCount>({
    adults: 2,
    children: 0,
    childAges: [],
  });

  // Load passenger count and session from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPassengers = localStorage.getItem("passengerCount");
      const savedSessionId = localStorage.getItem("bookingSessionId");
      const savedSessionExpiry = localStorage.getItem("sessionExpiry");

      if (savedPassengers) {
        try {
          setPassengerCount(JSON.parse(savedPassengers));
        } catch (e) {
          console.error("Failed to parse saved passenger count", e);
        }
      }

      // Check if session is still valid
      if (savedSessionId && savedSessionExpiry) {
        const expiryTime = new Date(savedSessionExpiry).getTime();
        if (Date.now() < expiryTime) {
          setSessionId(savedSessionId);
        } else {
          // Session expired, clear it
          localStorage.removeItem("bookingSessionId");
          localStorage.removeItem("sessionExpiry");
        }
      }
    }
  }, []);

  // Save passenger count to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("passengerCount", JSON.stringify(passengerCount));
    }
  }, [passengerCount]);

  const createSession = async (cruiseId: string): Promise<string> => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/booking/session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cruiseId,
            passengerCount,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create booking session");
      }

      const data = await response.json();
      const newSessionId = data.sessionId;
      const expiresAt = data.expiresAt;

      // Save to state and localStorage
      setSessionId(newSessionId);
      if (typeof window !== "undefined") {
        localStorage.setItem("bookingSessionId", newSessionId);
        localStorage.setItem("sessionExpiry", expiresAt);
      }

      return newSessionId;
    } catch (error) {
      console.error("Failed to create booking session:", error);
      throw error;
    }
  };

  const clearSession = () => {
    setSessionId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("bookingSessionId");
      localStorage.removeItem("sessionExpiry");
    }
  };

  return (
    <BookingContext.Provider
      value={{
        sessionId,
        passengerCount,
        setPassengerCount,
        createSession,
        clearSession,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error("useBooking must be used within a BookingProvider");
  }
  return context;
}
