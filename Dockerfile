FROM node:22-slim

WORKDIR /app

COPY package*.json ./

# Install the full dependency set because the production build uses
# Vite/esbuild and other development tooling.
RUN npm ci

COPY . .

# Firebase Web Client configuration is embedded by Vite at build time.
# These are public client configuration values, not server credentials.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID

ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

RUN npm run build

# Only runtime dependencies belong in the deployed image.
RUN npm prune --omit=dev

ENV NODE_ENV=production

# Cloud Run does not require root. Run the application with the unprivileged
# Node image user so an application-layer compromise does not become root in
# the container.
USER node

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
