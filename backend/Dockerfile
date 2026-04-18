FROM node:25-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db execute --file prisma/init.sql --schema prisma/schema.prisma && npx prisma migrate deploy && node dist/app.js"]
