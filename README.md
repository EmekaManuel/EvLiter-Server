# EvLiter Server (Node.js + Express + TypeScript + OpenAI)

## Setup

1. Clone this repo and enter the folder.
2. Copy `ENV.example` to `.env` and set your variables:

```
OPENAI_API_KEY=your_openai_api_key
PORT=3000
OPENAI_MODEL=gpt-4o-mini
```

3. Install dependencies:

```
npm install
```

## Scripts

- `npm run dev`: Start dev server with tsx watcher
- `npm run build`: TypeScript build to `dist/`
- `npm run start`: Run compiled server
- `npm run typecheck`: Type-only check

## API

- Health: `GET /health`
- Chat: `POST /api/ai/chat`
  - Body (either `prompt` or `messages` required):

```json
{
  "prompt": "Explain what EV battery degradation means"
}
```

or

```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Explain what EV battery degradation means" }
  ],
  "model": "gpt-4o-mini",
  "temperature": 0.7
}
```

- Response:

```json
{
  "reply": "... assistant message ...",
  "model": "gpt-4o-mini"
}
```

### Car Recognition

Base path: `/api/ai/car-recognition`

- VIN: `POST /api/ai/car-recognition/vin`

  - Body:

  ```json
  { "vin": "1HGCM82633A004352" }
  ```

  - Response (example):

  ```json
  {
    "vin": "1HGCM82633A004352",
    "make": "Honda",
    "model": "Accord",
    "year": 2003,
    "trim": "EX",
    "bodyStyle": "Sedan",
    "drivetrain": "FWD",
    "engine": "2.4L I4",
    "battery": "N/A",
    "imageUrl": "https://example.com/images/honda-accord-2003.jpg",
    "connectorTypes": ["Type1", "CCS1"],
    "charging": {
      "capacityKWh": 12.5,
      "acMaxKw": 7.2,
      "dcMaxKw": 50,
      "onboardChargerKw": 7.2,
      "chargePortLocation": "rear-left"
    },
    "confidence": 0.86
  }
  ```

- Make/Model/Year: `POST /api/ai/car-recognition/model`
  - Body:
  ```json
  { "make": "Tesla", "model": "Model 3", "year": 2022 }
  ```
  - Response (example):
  ```json
  {
    "make": "Tesla",
    "model": "Model 3",
    "year": 2022,
    "trim": "Long Range",
    "bodyStyle": "Sedan",
    "drivetrain": "AWD",
    "battery": "82 kWh",
    "imageUrl": "https://example.com/images/tesla-model-3-2022.jpg",
    "connectorTypes": ["CCS2", "NACS"],
    "charging": {
      "capacityKWh": 82,
      "acMaxKw": 11,
      "dcMaxKw": 250,
      "onboardChargerKw": 11,
      "chargePortLocation": "rear-left"
    },
    "confidence": 0.78
  }
  ```

## Notes

- Requires Node 18+.
- The server starts even without `OPENAI_API_KEY`; AI endpoints will return a 500 until it is set.
# EvLiter-Server
