#!/bin/bash
# EV Advisor API - cURL Test Commands (No jq dependency)
# Replace BASE_URL with your actual API endpoint

BASE_URL="http://localhost:3000/api/ai"

echo "========================================="
echo "EV ADVISOR API - cURL TEST SUITE"
echo "========================================="
echo ""

# ===========================================
# 1. CHARGING TIME CALCULATOR
# ===========================================
echo "1. Testing Charging Time Calculator (AC Charger)"
echo "-------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/charging-time" \
  -H "Content-Type: application/json" \
  -d '{
    "batteryCapacityKWh": 75,
    "currentChargePercent": 20,
    "targetChargePercent": 80,
    "chargerPowerKw": 11,
    "chargerType": "AC",
    "efficiency": 0.9
  }'

echo -e "\n\n"

echo "2. Testing Charging Time Calculator (DC Fast Charger)"
echo "------------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/charging-time" \
  -H "Content-Type: application/json" \
  -d '{
    "batteryCapacityKWh": 60,
    "currentChargePercent": 10,
    "targetChargePercent": 80,
    "chargerPowerKw": 50,
    "chargerType": "DC",
    "efficiency": 0.95
  }'

echo -e "\n\n"

echo "3. Testing Charging Time Calculator (Home Charger - Full Charge)"
echo "----------------------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/charging-time" \
  -H "Content-Type: application/json" \
  -d '{
    "batteryCapacityKWh": 40,
    "currentChargePercent": 5,
    "targetChargePercent": 100,
    "chargerPowerKw": 7.4,
    "chargerType": "AC"
  }'

echo -e "\n\n"

# ===========================================
# 4. COST ESTIMATE CALCULATOR
# ===========================================
echo "4. Testing Cost Estimate (Home - Off Peak)"
echo "-------------------------------------------"
curl -X POST "${BASE_URL}/advisor/cost-estimate" \
  -H "Content-Type: application/json" \
  -d '{
    "energyKWh": 45,
    "location": "Lagos",
    "chargerType": "home",
    "timeOfDay": "off_peak"
  }'

echo -e "\n\n"

echo "5. Testing Cost Estimate (Home - Peak Hours)"
echo "---------------------------------------------"
curl -X POST "${BASE_URL}/advisor/cost-estimate" \
  -H "Content-Type: application/json" \
  -d '{
    "energyKWh": 45,
    "location": "Lagos",
    "chargerType": "home",
    "timeOfDay": "peak"
  }'

echo -e "\n\n"

echo "6. Testing Cost Estimate (Public AC)"
echo "-------------------------------------"
curl -X POST "${BASE_URL}/advisor/cost-estimate" \
  -H "Content-Type: application/json" \
  -d '{
    "energyKWh": 35,
    "location": "Abuja",
    "chargerType": "public_ac",
    "timeOfDay": "standard"
  }'

echo -e "\n\n"

echo "7. Testing Cost Estimate (Public DC Fast - Peak)"
echo "-------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/cost-estimate" \
  -H "Content-Type: application/json" \
  -d '{
    "energyKWh": 42,
    "location": "Port Harcourt",
    "chargerType": "public_dc",
    "timeOfDay": "peak"
  }'

echo -e "\n\n"

# ===========================================
# 8. AI RECOMMENDATIONS
# ===========================================
echo "8. Testing AI Recommendations (Tesla Model 3 - Lagos)"
echo "------------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/recommendations" \
  -H "Content-Type: application/json" \
  -d '{
    "car": {
      "make": "Tesla",
      "model": "Model 3",
      "year": 2023,
      "batteryCapacityKWh": 60,
      "rangeKm": 491
    },
    "location": {
      "city": "Lagos",
      "state": "Lagos State"
    },
    "preferences": {
      "dailyDrivingKm": 50,
      "chargingFrequency": "weekly",
      "prioritizeSpeed": false,
      "homeCharging": true
    }
  }'

echo -e "\n\n"

echo "9. Testing AI Recommendations (Nissan Leaf - Abuja)"
echo "----------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/recommendations" \
  -H "Content-Type: application/json" \
  -d '{
    "car": {
      "make": "Nissan",
      "model": "Leaf",
      "year": 2022,
      "batteryCapacityKWh": 40,
      "rangeKm": 270
    },
    "location": {
      "city": "Abuja",
      "state": "FCT"
    },
    "preferences": {
      "dailyDrivingKm": 80,
      "chargingFrequency": "daily",
      "prioritizeSpeed": true,
      "homeCharging": false
    }
  }'

echo -e "\n\n"

echo "10. Testing AI Recommendations (Minimal Info - Port Harcourt)"
echo "-------------------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/recommendations" \
  -H "Content-Type: application/json" \
  -d '{
    "car": {
      "make": "Hyundai",
      "model": "Kona Electric",
      "year": 2024
    },
    "location": {
      "city": "Port Harcourt"
    }
  }'

echo -e "\n\n"

# ===========================================
# 11. GET PRICING INFORMATION
# ===========================================
echo "11. Testing Get All Pricing Info"
echo "---------------------------------"
curl -X GET "${BASE_URL}/advisor/pricing"

echo -e "\n\n"

echo "12. Testing Get Pricing for Home Charging"
echo "------------------------------------------"
curl -X GET "${BASE_URL}/advisor/pricing?charger_type=home"

echo -e "\n\n"

echo "13. Testing Get Pricing for Public DC"
echo "--------------------------------------"
curl -X GET "${BASE_URL}/advisor/pricing?charger_type=public_dc"

echo -e "\n\n"

echo "14. Testing Get Pricing with Location"
echo "--------------------------------------"
curl -X GET "${BASE_URL}/advisor/pricing?location=Lagos&charger_type=public_ac"

echo -e "\n\n"

# ===========================================
# ERROR CASES
# ===========================================
echo "15. Testing Invalid Charging Time Request (Missing Field)"
echo "----------------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/charging-time" \
  -H "Content-Type: application/json" \
  -d '{
    "batteryCapacityKWh": 75,
    "currentChargePercent": 20
  }'

echo -e "\n\n"

echo "16. Testing Invalid Cost Estimate (Negative Energy)"
echo "----------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/cost-estimate" \
  -H "Content-Type: application/json" \
  -d '{
    "energyKWh": -10,
    "location": "Lagos",
    "chargerType": "home"
  }'

echo -e "\n\n"

echo "17. Testing Invalid Recommendation Request (Invalid Year)"
echo "----------------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/recommendations" \
  -H "Content-Type: application/json" \
  -d '{
    "car": {
      "make": "Tesla",
      "model": "Model S",
      "year": 1800
    },
    "location": {
      "city": "Lagos"
    }
  }'

echo -e "\n\n"

# ===========================================
# COMBINED WORKFLOW
# ===========================================
echo "18. Testing Combined Workflow (Calculate Time + Cost)"
echo "------------------------------------------------------"
echo "Step 1: Calculate charging time..."
TIME_RESPONSE=$(curl -s -X POST "${BASE_URL}/advisor/charging-time" \
  -H "Content-Type: application/json" \
  -d '{
    "batteryCapacityKWh": 60,
    "currentChargePercent": 25,
    "targetChargePercent": 85,
    "chargerPowerKw": 7.4,
    "chargerType": "AC"
  }')

echo "$TIME_RESPONSE"

# Extract energy needed using grep and sed (works without jq)
ENERGY_NEEDED=$(echo "$TIME_RESPONSE" | grep -o '"energyNeededKWh":[0-9.]*' | grep -o '[0-9.]*$')

echo -e "\nStep 2: Calculate cost for ${ENERGY_NEEDED} kWh..."
curl -X POST "${BASE_URL}/advisor/cost-estimate" \
  -H "Content-Type: application/json" \
  -d "{
    \"energyKWh\": ${ENERGY_NEEDED},
    \"location\": \"Lagos\",
    \"chargerType\": \"home\",
    \"timeOfDay\": \"off_peak\"
  }"

echo -e "\n\n"

# ===========================================
# REAL-WORLD SCENARIOS
# ===========================================
echo "19. Real-World Scenario: Weekly Home Charging (Nissan Leaf)"
echo "------------------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/charging-time" \
  -H "Content-Type: application/json" \
  -d '{
    "batteryCapacityKWh": 40,
    "currentChargePercent": 30,
    "targetChargePercent": 90,
    "chargerPowerKw": 7.4,
    "chargerType": "AC",
    "efficiency": 0.92
  }'

echo -e "\n\n"

echo "20. Real-World Scenario: Road Trip Fast Charging"
echo "-------------------------------------------------"
curl -X POST "${BASE_URL}/advisor/charging-time" \
  -H "Content-Type: application/json" \
  -d '{
    "batteryCapacityKWh": 75,
    "currentChargePercent": 15,
    "targetChargePercent": 80,
    "chargerPowerKw": 150,
    "chargerType": "DC",
    "efficiency": 0.93
  }'

echo -e "\n\n"

echo "========================================="
echo "TEST SUITE COMPLETED"
echo "========================================="