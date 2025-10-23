import creditCardType from "credit-card-type";

/**
 * Credit card type detection and validation utilities
 * Maps credit-card-type library card types to Traveltek API card type codes
 */
const CARD_TYPE_TO_TRAVELTEK_CODE: Record<string, string> = {
  visa: "VIS",
  mastercard: "MSC",
  "american-express": "AMX",
  maestro: "MAE",
  "diners-club": "DIN",
};

/**
 * Maps Traveltek codes to display names
 */
const TRAVELTEK_CODE_TO_NAME: Record<string, string> = {
  VIS: "Visa",
  MSC: "Mastercard",
  AMX: "American Express",
  MAE: "Maestro",
  DIN: "Diners Club",
};

/**
 * Detects the credit card type from a card number and returns Traveltek-compatible info
 * @param cardNumber - The credit card number (can include spaces)
 * @returns Object with card type info and Traveltek code
 */
export function detectCardType(cardNumber: string): {
  type: string | null;
  traveltekCode: string | null;
  name: string | null;
  isValid: boolean;
} {
  // Remove spaces and non-digits
  const cleanNumber = cardNumber.replace(/\D/g, "");

  if (!cleanNumber) {
    return {
      type: null,
      traveltekCode: null,
      name: null,
      isValid: false,
    };
  }

  // Detect card type using credit-card-type library
  const cardTypes = creditCardType(cleanNumber);

  if (cardTypes.length === 0) {
    return {
      type: null,
      traveltekCode: null,
      name: null,
      isValid: false,
    };
  }

  // Get the first (most likely) match
  const detectedType = cardTypes[0];
  const cardTypeKey = detectedType.type;

  // Map to Traveltek code
  const traveltekCode = CARD_TYPE_TO_TRAVELTEK_CODE[cardTypeKey] || null;
  const name = traveltekCode ? TRAVELTEK_CODE_TO_NAME[traveltekCode] : null;

  // Validate card number using Luhn algorithm
  const isValid = validateCardNumber(cleanNumber);

  return {
    type: cardTypeKey,
    traveltekCode,
    name,
    isValid,
  };
}

/**
 * Validates a credit card number using the Luhn algorithm
 * @param cardNumber - The credit card number (digits only)
 * @returns True if the card number is valid
 */
export function validateCardNumber(cardNumber: string): boolean {
  // Remove spaces and non-digits
  const cleanNumber = cardNumber.replace(/\D/g, "");

  if (!cleanNumber || cleanNumber.length < 13) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  // Loop through values starting from the rightmost digit
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Formats a card number with spaces for display
 * @param cardNumber - The credit card number
 * @returns Formatted card number with spaces
 */
export function formatCardNumber(cardNumber: string): string {
  // Remove all non-digits
  const cleanNumber = cardNumber.replace(/\D/g, "");

  // Format in groups of 4
  const groups = cleanNumber.match(/.{1,4}/g);
  return groups ? groups.join(" ") : cleanNumber;
}
