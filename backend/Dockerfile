FROM node:24.18.0

WORKDIR /app

RUN chown node:node /app
RUN mkdir -p /home/node/.npm && chown -R node:node /home/node

COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma

USER node

RUN npm ci
RUN npx prisma generate

COPY --chown=node:node . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
