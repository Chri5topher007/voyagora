
FROM node:18-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
RUN mkdir -p /app/uploads
COPY package*.json ./
# --include=dev is explicit here because some hosts (Render included) set
# NODE_ENV=production during the build step, which makes plain `npm install`
# silently skip devDependencies — including `prisma` and `typescript`, both
# required just below to generate the client and compile the app.
RUN npm install --legacy-peer-deps --include=dev
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
# start:prod pushes the Prisma schema to the database before booting, so a
# brand-new empty database (e.g. a fresh Supabase project) gets its tables
# created automatically on first deploy instead of crashing on missing tables.
CMD ["npm", "run", "start:prod"]
