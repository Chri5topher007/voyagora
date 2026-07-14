
FROM node:18-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
RUN mkdir -p /app/uploads
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
