#!/bin/bash

# Fix the broken mobile cruise card structure
sed -i '' '1488,1503d' frontend/app/cruises/CruisesContent.tsx
sed -i '' '1488i\
                            </div>\
                            {/* Right: Price block */}\
                            <div className="text-right flex-shrink-0">' frontend/app/cruises/CruisesContent.tsx
