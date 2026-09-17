FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

# The production build requires Vite and esbuild, which are devDependencies.
# Install the full dependency set for the build; runtime pruning happens afterward.
RUN npm ci

COPY . .

# Firebase Web Client configuration.
# These values are required at Vite build time.
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

# Remove build-only dependencies before the production image is deployed.
RUN npm prune --omit=dev

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
