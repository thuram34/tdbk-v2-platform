FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev=false
COPY tsconfig.json ./
COPY src ./src
ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 8787
CMD ["npm", "start"]
