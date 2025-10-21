"use client";

interface BookingProgressBarProps {
  currentStep: 1 | 2 | 3;
  compact?: boolean;
}

export default function BookingProgressBar({
  currentStep,
  compact = false,
}: BookingProgressBarProps) {
  const steps = [
    { number: 1, label: "Options" },
    { number: 2, label: "Passengers" },
    { number: 3, label: "Payment" },
  ];

  if (compact) {
    // Compact version for navigation bar
    return (
      <div className="flex items-center gap-1">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center gap-1">
            {/* Step circle */}
            <div
              className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-geograph font-bold text-xs md:text-sm transition-colors ${
                step.number <= currentStep
                  ? "bg-dark-blue text-white"
                  : "bg-gray-300 text-gray-600"
              }`}
            >
              {step.number}
            </div>

            {/* Label - only on desktop */}
            <span
              className={`hidden md:inline-block font-geograph text-[13px] font-medium transition-colors ${
                step.number === currentStep
                  ? "text-dark-blue"
                  : step.number < currentStep
                    ? "text-gray-500"
                    : "text-gray-400"
              }`}
            >
              {step.label}
            </span>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`w-6 md:w-12 h-0.5 mx-1 transition-colors ${
                  step.number < currentStep ? "bg-dark-blue" : "bg-gray-300"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Full version (not used in nav)
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-geograph font-bold text-sm ${
                  step.number <= currentStep
                    ? "bg-dark-blue text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                {step.number}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    step.number < currentStep ? "bg-dark-blue" : "bg-gray-300"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((step) => (
            <span
              key={step.number}
              className={`font-geograph text-xs ${
                step.number === currentStep
                  ? "text-dark-blue font-medium"
                  : "text-gray-500"
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
