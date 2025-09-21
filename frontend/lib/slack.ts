// Slack webhook integration utility

interface QuoteData {
  userEmail: string;
  cruiseData: {
    id?: string;
    name?: string;
    cruiseLineName?: string;
    shipName?: string;
    sailingDate?: string;
    nights?: number;
  };
  passengers: {
    adults: number;
    children: number;
    childAges?: number[];
  };
  discounts: {
    payInFull: boolean;
    age55Plus: boolean;
    military: boolean;
    stateOfResidence: string;
    loyaltyNumber: string;
    travelInsurance: boolean;
    customMessage?: string;
    additionalNotes?: string;
  };
  cabinType: string;
  cabinPrice: string | number;
}

export async function sendSlackQuoteNotification(quoteData: QuoteData) {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!slackWebhookUrl || slackWebhookUrl === "your_slack_webhook_url_here") {
    console.log("Slack webhook not configured, skipping notification");
    return { success: true, skipped: true };
  }

  try {
    const formatPrice = (price: string | number | undefined) => {
      if (!price) return "N/A";
      const numPrice = typeof price === "string" ? parseFloat(price) : price;
      if (isNaN(numPrice)) return "N/A";
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numPrice);
    };

    const formatDate = (dateString: string | undefined) => {
      if (!dateString) return "N/A";
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        });
      } catch {
        return dateString;
      }
    };

    // Format passenger information
    let passengerInfo = `${quoteData.passengers.adults} adult${quoteData.passengers.adults !== 1 ? "s" : ""}`;

    if (quoteData.passengers.children > 0) {
      passengerInfo += `, ${quoteData.passengers.children} child${quoteData.passengers.children !== 1 ? "ren" : ""}`;

      // Add child ages if available
      if (
        quoteData.passengers.childAges &&
        quoteData.passengers.childAges.length > 0
      ) {
        const ages = quoteData.passengers.childAges
          .map((age, i) => `Child ${i + 1}: ${age}yrs`)
          .join(", ");
        passengerInfo += `\n(Ages: ${ages})`;
      }
    }

    // Format discount qualifiers
    const activeDiscounts = [];
    if (quoteData.discounts.payInFull)
      activeDiscounts.push("Pay in full/non-refundable");
    if (quoteData.discounts.age55Plus) activeDiscounts.push("55 or older");
    if (quoteData.discounts.military) activeDiscounts.push("Military/Veteran");
    if (quoteData.discounts.stateOfResidence)
      activeDiscounts.push(
        `Resident of ${quoteData.discounts.stateOfResidence}`,
      );
    if (quoteData.discounts.loyaltyNumber)
      activeDiscounts.push(`Loyalty: ${quoteData.discounts.loyaltyNumber}`);

    // Create the Slack message payload
    const slackMessage = {
      text: "🚢 New Cruise Quote Request",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🚢 New Cruise Quote Request",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Customer Email:*\n${quoteData.userEmail}`,
            },
            {
              type: "mrkdwn",
              text: `*Passengers:*\n${passengerInfo}`,
            },
          ],
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Cruise Details*",
          },
        },
        {
          type: "section",
          fields: [
            ...(quoteData.cruiseData.name
              ? [
                  {
                    type: "mrkdwn" as const,
                    text: `*Cruise:*\n${quoteData.cruiseData.name}`,
                  },
                ]
              : []),
            ...(quoteData.cruiseData.cruiseLineName
              ? [
                  {
                    type: "mrkdwn" as const,
                    text: `*Cruise Line:*\n${quoteData.cruiseData.cruiseLineName}`,
                  },
                ]
              : []),
            ...(quoteData.cruiseData.shipName
              ? [
                  {
                    type: "mrkdwn" as const,
                    text: `*Ship:*\n${quoteData.cruiseData.shipName}`,
                  },
                ]
              : []),
            ...(quoteData.cruiseData.sailingDate
              ? [
                  {
                    type: "mrkdwn" as const,
                    text: `*Sailing Date:*\n${formatDate(quoteData.cruiseData.sailingDate)}`,
                  },
                ]
              : []),
            ...(quoteData.cruiseData.nights
              ? [
                  {
                    type: "mrkdwn" as const,
                    text: `*Duration:*\n${quoteData.cruiseData.nights} nights`,
                  },
                ]
              : []),
            {
              type: "mrkdwn",
              text: `*Cabin Type:*\n${quoteData.cabinType}`,
            },
            {
              type: "mrkdwn",
              text: `*Starting Price:*\n${formatPrice(quoteData.cabinPrice)} per person`,
            },
            ...(quoteData.discounts.travelInsurance
              ? [
                  {
                    type: "mrkdwn" as const,
                    text: `*Travel Insurance:*\nInterested`,
                  },
                ]
              : []),
          ],
        },
        ...(activeDiscounts.length > 0
          ? [
              {
                type: "divider" as const,
              },
              {
                type: "section" as const,
                text: {
                  type: "mrkdwn" as const,
                  text: `*Discount Qualifiers:*\n• ${activeDiscounts.join("\n• ")}`,
                },
              },
            ]
          : []),
        ...(quoteData.discounts.customMessage
          ? [
              {
                type: "divider" as const,
              },
              {
                type: "section" as const,
                text: {
                  type: "mrkdwn" as const,
                  text: `*Additional Information from Customer:*\n${quoteData.discounts.customMessage}`,
                },
              },
            ]
          : []),
        ...(quoteData.discounts.additionalNotes
          ? [
              {
                type: "section" as const,
                text: {
                  type: "mrkdwn" as const,
                  text: `*Customer Comments:*\n${quoteData.discounts.additionalNotes}`,
                },
              },
            ]
          : []),
        {
          type: "divider",
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `⏰ Submitted: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} EST | 🆔 Cruise ID: ${quoteData.cruiseData.id || "N/A"}`,
            },
          ],
        },
      ],
    };

    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      throw new Error(
        `Slack webhook request failed: ${response.status} ${response.statusText}`,
      );
    }

    return { success: true, sent: true };
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
