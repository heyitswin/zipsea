/**
 * Calculate On-Board Credit (OBC) from cabin breakdown data
 *
 * OBC is calculated as 10% of the net commissionable fare per guest,
 * rounded down to the nearest $10.
 *
 * Commissionable fare = base fare + discounts (discounts are negative)
 */
export function calculateObcFromBreakdown(breakdownData: any): number {
  const breakdownItems = breakdownData.results || [];

  // Extract fare and discount items
  const fareItems = breakdownItems.filter(
    (item: any) => item.category?.toLowerCase() === 'fare'
  );
  const discountItems = breakdownItems.filter(
    (item: any) => item.category?.toLowerCase() === 'discount'
  );

  // Build per-guest commissionable fares (fare + discount per guest)
  const guestCommissionableFares = new Map<string, number>();

  // Add base fares per guest
  fareItems.forEach((fareItem: any) => {
    if (fareItem.prices && Array.isArray(fareItem.prices)) {
      fareItem.prices.forEach((priceItem: any) => {
        const guestNo = priceItem.guestno || String(guestCommissionableFares.size + 1);
        const guestFare = parseFloat(priceItem.sprice || priceItem.price || 0);
        if (guestFare > 0) {
          guestCommissionableFares.set(
            guestNo,
            (guestCommissionableFares.get(guestNo) || 0) + guestFare
          );
        }
      });
    }
  });

  // Apply discounts per guest
  discountItems.forEach((discountItem: any) => {
    if (discountItem.prices && Array.isArray(discountItem.prices)) {
      discountItem.prices.forEach((priceItem: any) => {
        const guestNo = priceItem.guestno || String(guestCommissionableFares.size);
        const discountAmount = parseFloat(priceItem.sprice || priceItem.price || 0);
        guestCommissionableFares.set(
          guestNo,
          (guestCommissionableFares.get(guestNo) || 0) + discountAmount
        );
      });
    }
  });

  // Calculate total OBC (10% of net commissionable fares per guest, rounded down to nearest $10)
  let totalObc = 0;
  guestCommissionableFares.forEach((commissionableFare) => {
    if (commissionableFare > 0) {
      const guestObc = Math.floor((commissionableFare * 0.1) / 10) * 10;
      totalObc += guestObc;
    }
  });

  return totalObc;
}
