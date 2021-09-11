FROM node:14.1.0-stretch-slim

RUN mkdir app
WORKDIR /app/
COPY . .

EXPOSE 8080
RUN yarn install

CMD [ "node", "app.js" ]
