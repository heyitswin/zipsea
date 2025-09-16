// This is the updated mobile layout structure for cruise cards
// The price block should be at the top with cruise name

                      {/* Cruise Details */}
                      <div className="flex-1 flex flex-col md:flex-row md:justify-between md:items-center p-3 md:p-0">
                        <div className="flex-1">
                          {/* Mobile: Name and price on same line */}
                          <div className="md:hidden flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h3
                                className="font-whitney font-black uppercase text-[#2F2F2F] text-[16px] mb-1"
                                style={{ letterSpacing: "-0.02em" }}
                              >
                                {cruise.name}
                              </h3>
                              <p className="font-geograph text-[12px] text-[#606060]">
                                {cruise.cruiseLine?.name || "Unknown Line"}
                              </p>
                              <p className="font-geograph text-[12px] text-[#606060]">
                                {cruise.ship?.name || "Unknown Ship"}
                              </p>
                            </div>
                            {/* Price block moved here */}
                            <div className="text-right">
                              <div className="font-geograph font-bold text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                                STARTING FROM
                              </div>
                              <div className="font-geograph font-bold text-[18px] text-dark-blue">
                                {(() => {
                                  const prices: number[] = [];
                                  if (cruise.pricing) {
                                    [cruise.pricing.interior, cruise.pricing.oceanview, cruise.pricing.balcony, cruise.pricing.suite, cruise.pricing.lowestPrice].forEach((p) => {
                                      if (p && p !== "0" && p !== "null") {
                                        const num = Number(p);
                                        if (!isNaN(num) && num > 0) prices.push(num);
                                      }
                                    });
                                  }
                                  if (cruise.combined) {
                                    [cruise.combined.inside, cruise.combined.outside, cruise.combined.balcony, cruise.combined.suite].forEach((p) => {
                                      if (p && p !== "0" && p !== "null") {
                                        const num = Number(p);
                                        if (!isNaN(num) && num > 0) prices.push(num);
                                      }
                                    });
                                  }
                                  if (prices.length === 0) {
                                    [cruise.cheapestPrice, cruise.interiorPrice, cruise.oceanviewPrice, cruise.oceanViewPrice, cruise.balconyPrice, cruise.suitePrice].forEach((p) => {
                                      if (p && p !== "0" && p !== "null") {
                                        const num = Number(p);
                                        if (!isNaN(num) && num > 0) prices.push(num);
                                      }
                                    });
                                  }
                                  return prices.length > 0 ? formatPrice(Math.min(...prices)) : "Call for price";
                                })()}
                              </div>
                              {/* Onboard Credit Badge */}
                              {(() => {
                                const prices: number[] = [];
                                if (cruise.pricing) {
                                  [cruise.pricing.interior, cruise.pricing.oceanview, cruise.pricing.balcony, cruise.pricing.suite, cruise.pricing.lowestPrice].forEach((p) => {
                                    if (p && p !== "0" && p !== "null") {
                                      const num = Number(p);
                                      if (!isNaN(num) && num > 0) prices.push(num);
                                    }
                                  });
                                }
                                if (cruise.combined) {
                                  [cruise.combined.inside, cruise.combined.outside, cruise.combined.balcony, cruise.combined.suite].forEach((p) => {
                                    if (p && p !== "0" && p !== "null") {
                                      const num = Number(p);
                                      if (!isNaN(num) && num > 0) prices.push(num);
                                    }
                                  });
                                }
                                if (prices.length === 0) {
                                  [cruise.cheapestPrice, cruise.interiorPrice, cruise.oceanviewPrice, cruise.oceanViewPrice, cruise.balconyPrice, cruise.suitePrice].forEach((p) => {
                                    if (p && p !== "0" && p !== "null") {
                                      const num = Number(p);
                                      if (!isNaN(num) && num > 0) prices.push(num);
                                    }
                                  });
                                }
                                if (prices.length > 0) {
                                  const lowestPrice = Math.min(...prices);
                                  const creditPercent = 0.2;
                                  const rawCredit = lowestPrice * creditPercent;
                                  const onboardCredit = Math.floor(rawCredit / 10) * 10;
                                  if (onboardCredit > 0) {
                                    return (
                                      <div className="font-geograph font-medium text-[12px] text-white bg-[#1B8F57] px-2 py-1 rounded-[3px] mt-1">
                                        +${onboardCredit} onboard credit
                                      </div>
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </div>
                          </div>

                          {/* Desktop: Original layout */}
                          <div className="hidden md:block">
                            <h3
                              className="font-whitney font-black uppercase text-[#2F2F2F] text-[24px] mb-1"
                              style={{ letterSpacing: "-0.02em" }}
                            >
                              {cruise.name}
                            </h3>
                            <p className="font-geograph text-[16px] text-[#606060] mb-4">
                              {cruise.cruiseLine?.name || "Unknown Line"} |{" "}
                              {cruise.ship?.name || "Unknown Ship"}
                            </p>
                          </div>

                          {/* Mobile: Details on one line */}
                          <div className="md:hidden">
                            <div className="flex gap-4">
                              <div>
                                <div className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1" style={{ letterSpacing: "0.1em" }}>
                                  DEPART
                                </div>
                                <div className="font-geograph font-medium text-[12px] text-[#2F2F2F]">
                                  {(() => {
                                    const dateString = cruise.sailingDate || cruise.departureDate;
                                    if (!dateString) return "N/A";
                                    try {
                                      const date = new Date(dateString);
                                      return date.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "2-digit",
                                        timeZone: "UTC",
                                      }).replace(/,/g, "");
                                    } catch {
                                      return "N/A";
                                    }
                                  })()}
                                </div>
                              </div>
                              <div>
                                <div className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1" style={{ letterSpacing: "0.1em" }}>
                                  RETURN
                                </div>
                                <div className="font-geograph font-medium text-[12px] text-[#2F2F2F]">
                                  {(() => {
                                    const dateString = cruise.sailingDate || cruise.departureDate;
                                    if (!dateString || !cruise.nights) return "N/A";
                                    try {
                                      const departDate = new Date(dateString);
                                      const returnDate = new Date(departDate);
                                      returnDate.setUTCDate(departDate.getUTCDate() + cruise.nights);
                                      return returnDate.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "2-digit",
                                        timeZone: "UTC",
                                      }).replace(/,/g, "");
                                    } catch {
                                      return "N/A";
                                    }
                                  })()}
                                </div>
                              </div>
                              <div>
                                <div className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1" style={{ letterSpacing: "0.1em" }}>
                                  LEAVING
                                </div>
                                <div className="font-geograph font-medium text-[12px] text-[#2F2F2F]">
                                  {(() => {
                                    const portName = cruise.embarkPort?.name || cruise.embarkPortName || "Unknown";
                                    const commaIndex = portName.indexOf(",");
                                    return commaIndex > -1 ? portName.substring(0, commaIndex) : portName;
                                  })()}
                                </div>
                              </div>
                              <div>
                                <div className="font-geograph font-bold text-[9px] uppercase text-gray-500 mb-1" style={{ letterSpacing: "0.1em" }}>
                                  NIGHTS
                                </div>
                                <div className="font-geograph font-medium text-[12px] text-[#2F2F2F]">
                                  {cruise.nights}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Desktop grid layout - continues as before */}
