#Splits 


## Overview
Splits is a decentralized application that allows users to manage shared expenses using stablecoins (USDC). Users can interact with an AI model to create and modify expense splits, upload receipts for analysis, and process payments seamlessly.


### Backend
- The backend is designed to handle AI-related requests and health checks without maintaining a database.
- We used [0g-compute-ts-starter-kit](https://github.com/0gfoundation/0g-compute-ts-starter-kit) repo as a base for our backend implementation.


## Getting Started
1. **Clone the Repository**:
   ```
   git clone https://github.com/split-bubbles/split
   cd split
   ```

Note: Make sure to set up your environment variables by copying the example files (`.env.example`) in both the `backend` and `frontend` directories to `.env` and filling in the required values.

2. **Start the Backend**:
   ```
   cd backend
   npm install
   npm run build
   npm start
   ```

3. **Start the Frontend**:
   ```
   cd ../frontend
   npm install
   npm run dev
   ```   


## AI Usage 
We used Github Copilot to help us generate boilerplate code and write some UI components faseter.


