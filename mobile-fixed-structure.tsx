                          {/* Mobile: Cruise name/line/ship and price in flex layout */}
                          <div className="md:hidden flex justify-between items-start mb-2">
                            {/* Left: Cruise name and cruise line/ship */}
                            <div className="flex-1 mr-3">
                              <p className="font-geograph text-[14px] text-[#606060]">
                                {cruise.cruiseLine?.name || "Unknown Line"}
                              </p>
                              <p className="font-geograph text-[14px] text-[#606060]">
                                {cruise.ship?.name || "Unknown Ship"}
                              </p>
                            </div>
                            {/* Right: Price block */}
                            <div className="text-right flex-shrink-0">
                              <div className="font-geograph font-bold text-[12px] text-gray-500 uppercase tracking-wider mb-1">
                                STARTING FROM
                              </div>
                              <div className="font-geograph font-bold text-[20px] text-dark-blue">
                                {(() => {
                                  const prices: number[] = [];
                                  if (cruise.pricing) {
                                    [
                                      cruise.pricing.interior,
                                      cruise.pricing.oceanview,
                                      cruise.pricing.balcony,
                                      cruise.pricing.suite,
                                      cruise.pricing.lowestPrice,
                                    ].forEach((p) => {
                                      if (p && p !== "0" && p !== "null") {
                                        const num = Number(p);
                                        if (!isNaN(num) && num > 0)
                                          prices.push(num);
                                      }
                                    });
                                  }
                                  if (cruise.combined) {
                                    [
                                      cruise.combined.inside,
                                      cruise.combined.outside,
                                      cruise.combined.balcony,
                                      cruise.combined.suite,
                                    ].forEach((p) => {
                                      if (p && p !== "0" && p !== "null") {
                                        const num = Number(p);
                                        if (!isNaN(num) && num > 0)
                                          prices.push(num);
                                      }
                                    });
                                  }
                                  if (prices.length === 0) {
                                    [
                                      cruise.cheapestPrice,
                                      cruise.interiorPrice,
                                      cruise.oceanviewPrice,
                                      cruise.oceanViewPrice,
                                      cruise.balconyPrice,
                                      cruise.suitePrice,
                                    ].forEach((p) => {
                                      if (p && p !== "0" && p !== "null") {
                                        const num = Number(p);
                                        if (!isNaN(num) && num > 0)
                                          prices.push(num);
                                      }
                                    });
                                  }
                                  return prices.length > 0
                                    ? formatPrice(Math.min(...prices))
                                    : "Call for price";
                                })()}
                              </div>
                              {/* Onboard Credit Badge */}
                              {(() => {
                                const prices: number[] = [];
                                if (cruise.pricing) {
                                  [
                                    cruise.pricing.interior,
                                    cruise.pricing.oceanview,
                                    cruise.pricing.balcony,
                                    cruise.pricing.suite,
                                    cruise.pricing.lowestPrice,
                                  ].forEach((p) => {
                                    if (p && p !== "0" && p !== "null") {
                                      const num = Number(p);
                                      if (!isNaN(num) && num > 0)
                                        prices.push(num);
                                    }
                                  });
                                }
                                if (cruise.combined) {
                                  [
                                    cruise.combined.inside,
                                    cruise.combined.outside,
                                    cruise.combined.balcony,
                                    cruise.combined.suite,
                                  ].forEach((p) => {
                                    if (p && p !== "0" && p !== "null") {
                                      const num = Number(p);
                                      if (!isNaN(num) && num > 0)
                                        prices.push(num);
                                    }
                                  });
                                }
                                if (prices.length === 0) {
                                  [
                                    cruise.cheapestPrice,
                                    cruise.interiorPrice,
                                    cruise.oceanviewPrice,
                                    cruise.oceanViewPrice,
                                    cruise.balconyPrice,
                                    cruise.suitePrice,
                                  ].forEach((p) => {
                                    if (p && p !== "0" && p !== "null") {
                                      const num = Number(p);
                                      if (!isNaN(num) && num > 0)
                                        prices.push(num);
                                    }
                                  });
                                }
                                if (prices.length > 0) {
                                  const lowestPrice = Math.min(...prices);
                                  const creditPercent = 0.2;
                                  const rawCredit = lowestPrice * creditPercent;
                                  const onboardCredit =
                                    Math.floor(rawCredit / 10) * 10;
                                  if (onboardCredit > 0) {
                                    return (
                                      <div className="font-geograph font-medium text-[14px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] mt-1">
                                        +${onboardCredit} onboard credit
                                      </div>
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </div>
                          </div>
