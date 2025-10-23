/**
 * Credit Card Type Detection Utility
 *
 * Maps credit card numbers to Traveltek's card type codes using the credit-card-type library.
 *
 * Traveltek Card Type Codes:
 * - VIS: Visa
 * - MSC: Mastercard
 * - MCD: Mastercard Debit
 * - MAE: Maestro
 * - DEL: Visa Debit
 * - AMX: American Express
 * - ELC: Visa Electron
 * - SOL: Solo
 * - ECA: Eurocard
 * - DIN: Diners Club
 * - MAU: Maestro UK
 */

import creditCardType, { types as CardType } from 'credit-card-type';

/**
 * Map credit-card-type library card types to Traveltek card type codes
 */
const CARD_TYPE_TO_TRAVELTEK_CODE: Record<string, string> = {
  'visa': 'VIS',
  'mastercard': 'MSC',
  'american-express': 'AMX',
  'maestro': 'MAE',
  'diners-club': 'DIN',
  // Note: Discover is not supported by Traveltek API
  // Note: We default Maestro to MAE, but could be MAU for UK cards
};

/**
 * Detects the credit card type from a card number and returns the Traveltek card type code
 *
 * @param cardNumber - The credit card number (can be partial)
 * @returns Object with card type info or null if unknown
 */
export function detectCardType(cardNumber: string): {
  type: string | null;
  traveltekCode: string | null;
  name: string | null;
  isValid: boolean;
} {
  // Remove spaces and dashes
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');

  // Get card type from library
  const cardTypes = creditCardType(cleanNumber);

  if (cardTypes.length === 0) {
    return {
      type: null,
      traveltekCode: null,
      name: null,
      isValid: false,
    };
  }

  // Use the first match (most specific)
  const cardType = cardTypes[0];
  const traveltekCode = CARD_TYPE_TO_TRAVELTEK_CODE[cardType.type] || null;

  return {
    type: cardType.type,
    traveltekCode,
    name: cardType.niceType,
    isValid: traveltekCode !== null, // Only valid if Traveltek supports it
  };
}

/**
 * Validates if a card number is complete and valid
 *
 * @param cardNumber - The credit card number
 * @returns True if the card number appears valid
 */
export function validateCardNumber(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');
  const cardTypes = creditCardType(cleanNumber);

  if (cardTypes.length === 0) {
    return false;
  }

  const cardType = cardTypes[0];

  // Check if the length matches expected length(s)
  const lengthValid = cardType.lengths.includes(cleanNumber.length);

  // Basic Luhn algorithm check
  const luhnValid = luhnCheck(cleanNumber);

  return lengthValid && luhnValid;
}

/**
 * Luhn algorithm for card number validation
 */
function luhnCheck(cardNumber: string): boolean {
  let sum = 0;
  let isEven = false;

  // Loop through values starting from the rightmost
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i), 10);

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
 * Format card number with spaces for display
 *
 * @param cardNumber - The credit card number
 * @returns Formatted card number with spaces
 */
export function formatCardNumber(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');
  const cardTypes = creditCardType(cleanNumber);

  if (cardTypes.length === 0) {
    // Default formatting: groups of 4
    return cleanNumber.replace(/(\d{4})/g, '$1 ').trim();
  }

  const cardType = cardTypes[0];

  // Format according to card type gaps
  if (cardType.gaps) {
    let formatted = '';
    let lastIndex = 0;

    cardType.gaps.forEach((gap) => {
      if (gap <= cleanNumber.length) {
        formatted += cleanNumber.substring(lastIndex, gap) + ' ';
        lastIndex = gap;
      }
    });

    formatted += cleanNumber.substring(lastIndex);
    return formatted.trim();
  }

  // Fallback to groups of 4
  return cleanNumber.replace(/(\d{4})/g, '$1 ').trim();
}

/**
 * Get card icon/logo based on card type
 * Returns the appropriate emoji or could be extended to return image paths
 */
export function getCardIcon(cardType: string | null): string {
  switch (cardType) {
    case 'visa':
      return '💳'; // Could return '/images/cards/visa.svg'
    case 'mastercard':
      return '💳'; // Could return '/images/cards/mastercard.svg'
    case 'american-express':
      return '💳'; // Could return '/images/cards/amex.svg'
    case 'maestro':
      return '💳'; // Could return '/images/cards/maestro.svg'
    case 'diners-club':
      return '💳'; // Could return '/images/cards/diners.svg'
    default:
      return '💳';
  }
}

/**
 * Check if a card type is supported by Traveltek
 */
export function isSupportedByTraveltek(cardType: string): boolean {
  return cardType in CARD_TYPE_TO_TRAVELTEK_CODE;
}
